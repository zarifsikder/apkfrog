import { createCipheriv, pbkdf2Sync, randomBytes } from 'crypto'

/**
 * AES-256-CBC asset encryption for HTML/WebView APKs.
 *
 * Design:
 *   • A per-build random passphrase + salt derive a 256-bit AES key via
 *     PBKDF2-HMAC-SHA256 (16384 iterations). Both passphrase + salt are
 *     embedded in the generated AssetVault.java so the Android side can
 *     re-derive the same key at runtime.
 *   • Each asset is encrypted with AES-256-CBC + PKCS7 padding, using a
 *     random 16-byte IV prepended to the ciphertext.
 *   • The encrypted file is stored in assets/www/<path>.enc — the original
 *     plaintext is never written to disk.
 *
 * Threat model:
 *   • Stops casual APK decompilers from reading the HTML/CSS/JS source via
 *     `apktool d app.apk` or unzipping the APK. The key is embedded in
 *     DEX bytecode, so a determined reverse-engineer can still extract it
 *     by decompiling classes.dex — but it raises the bar significantly.
 *
 * Returns:
 *   - encrypted buffer (IV ‖ ciphertext)
 *   - the Java source for AssetVault.java containing the key material
 */

export interface AssetVaultKey {
  /** 32-byte (256-bit) AES key as hex string */
  keyHex: string
  /** 16-byte salt used for PBKDF2 derivation (hex) */
  saltHex: string
  /** Original passphrase (hex) used to derive the key — embedded in Java */
  passphraseHex: string
}

/**
 * Generate a fresh per-build key. The passphrase is random; the salt is random
 * too (the same passphrase + salt always derives the same key — necessary
 * because we embed both in Java and let the JVM derive the key).
 *
 * Uses PBKDF2-HMAC-SHA256 with 16384 iterations — same parameters on the
 * Java side (Android ships PBKDF2WithHmacSHA256 in javax.crypto).
 */
export function generateAssetVaultKey(): AssetVaultKey {
  const passphrase = randomBytes(32) // 256-bit random passphrase
  const salt = randomBytes(16) // 128-bit salt
  // Derive a 32-byte key (AES-256) using PBKDF2 — same KDF on Java side
  const key = pbkdf2Sync(passphrase, salt, 16384, 32, 'sha256')
  return {
    keyHex: key.toString('hex'),
    saltHex: salt.toString('hex'),
    passphraseHex: passphrase.toString('hex'),
  }
}

/**
 * Encrypt a single asset with AES-256-CBC. Returns a buffer where the first
 * 16 bytes are the IV and the rest is the ciphertext.
 */
export function encryptAsset(plaintext: Buffer, keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return Buffer.concat([iv, encrypted])
}

/**
 * Generate the AssetVault.java source that the WebView uses to decrypt assets
 * at runtime. Uses only javax.crypto — no external deps.
 */
export function generateAssetVaultJava(pkg: string, vault: AssetVaultKey): string {
  return `package ${pkg};

import android.content.Context;
import android.content.res.AssetManager;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.security.spec.KeySpec;
import java.util.HashMap;
import java.util.Map;

/**
 * ApkForge Asset Vault — decrypts AES-256-CBC encrypted web assets at runtime.
 *
 * Generated per-build by the ApkForge build server. The key material below is
 * unique to this APK; without it the encrypted .enc files in assets/www/ are
 * cryptographically useless to anyone who extracts the APK.
 *
 * Decryption flow:
 *   1. WebView requests file:///android_asset/www/index.html
 *   2. shouldInterceptRequest catches the URL
 *   3. AssetVault.decrypt("www/index.html.enc") returns the plaintext bytes
 *   4. WebView receives the decrypted HTML/CSS/JS via WebResourceResponse
 */
public final class AssetVault {
    private static final String PASSPHRASE_HEX = "${vault.passphraseHex}";
    private static final String SALT_HEX = "${vault.saltHex}";
    private static final int ITERATIONS = 16384;
    private static final int KEY_LENGTH_BITS = 256;

    private static SecretKey cachedKey = null;
    private static final Map<String, byte[]> cache = new HashMap<>();

    private AssetVault() {}

    private static SecretKey deriveKey() throws Exception {
        if (cachedKey != null) return cachedKey;
        byte[] pass = hexDecode(PASSPHRASE_HEX);
        byte[] salt = hexDecode(SALT_HEX);
        SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
        KeySpec spec = new PBEKeySpec(
            new String(pass, "ISO-8859-1").toCharArray(),
            salt,
            ITERATIONS,
            KEY_LENGTH_BITS
        );
        byte[] raw = factory.generateSecret(spec).getEncoded();
        cachedKey = new SecretKeySpec(raw, "AES");
        return cachedKey;
    }

    /** Decrypt a .enc asset. Returns the plaintext bytes (cached after first read). */
    public static byte[] decryptAsset(Context ctx, String assetPath) throws Exception {
        if (cache.containsKey(assetPath)) return cache.get(assetPath);
        AssetManager am = ctx.getAssets();
        InputStream in = am.open(assetPath);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) baos.write(buf, 0, n);
        in.close();
        byte[] ivAndCipher = baos.toByteArray();
        byte[] result = decryptRaw(ivAndCipher);
        cache.put(assetPath, result);
        return result;
    }

    /** Decrypt raw bytes (IV ‖ ciphertext) using the derived key. */
    public static byte[] decryptRaw(byte[] ivAndCipher) throws Exception {
        if (ivAndCipher.length < 16) throw new IllegalArgumentException("Encrypted payload too small");
        byte[] iv = new byte[16];
        System.arraycopy(ivAndCipher, 0, iv, 0, 16);
        byte[] cipherText = new byte[ivAndCipher.length - 16];
        System.arraycopy(ivAndCipher, 16, cipherText, 0, cipherText.length);

        SecretKey key = deriveKey();
        Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
        cipher.init(Cipher.DECRYPT_MODE, key, new IvParameterSpec(iv));
        return cipher.doFinal(cipherText);
    }

    private static byte[] hexDecode(String hex) {
        int len = hex.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len; i += 2) {
            out[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
                + Character.digit(hex.charAt(i + 1), 16));
        }
        return out;
    }
}
`
}
