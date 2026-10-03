# ApkForge cPanel Storage

Persistent file storage for ApkForge on Vercel using your existing cPanel hosting.

## Why this exists

Vercel's serverless filesystem is **ephemeral** — `/tmp` is wiped on every cold start. This means build source zips, APK artifacts, and app release APKs would disappear between requests, breaking builds and APK downloads.

**Solution:** upload these files to your own cPanel hosting via a tiny PHP API. This is completely free, persistent, and uses hosting you already pay for.

## Setup (5 minutes)

### 1. Upload `storage.php` to your cPanel

Upload the file `cpanel-storage/storage.php` from this repo to your cPanel hosting, e.g.:
```
public_html/storage.php
```

### 2. Create the storage directory

Next to `storage.php`, create a directory called `storage-data`:
```
public_html/storage-data/
```

Set its permissions to `755` (or `775` if your cPanel runs PHP as a different user). The script will create subdirectories inside it automatically.

> **Security tip:** for max safety, place `storage-data/` **outside** `public_html/` (e.g. in your home directory) so it cannot be accessed directly via a URL. Edit `STORAGE_DIR` in `storage.php` to point to the absolute path, e.g. `/home/youruser/storage-data`.

### 3. Set a secret key

Edit `storage.php` and change the `STORAGE_KEY` constant to a long random string:
```php
const STORAGE_KEY = 'your-very-long-random-secret-key-here-12345';
```

Or set it via a `.htaccess` env var (more secure — the key isn't in the source file):
```apache
SetEnv CPANEL_STORAGE_KEY your-very-long-random-secret-key-here-12345
```

### 4. Test the script

Visit the health endpoint in your browser:
```
https://yourdomain.com/storage.php?action=health
```
You should see:
```json
{"ok":true,"storage":"cpanel","version":"1.0.0","bytesUsed":0,"fileCount":0,"maxBytes":104857600}
```

### 5. Add env vars to Vercel

In your Vercel project settings → Environment Variables, add:
```
CPANEL_STORAGE_URL   = https://yourdomain.com/storage.php
CPANEL_STORAGE_KEY   = your-very-long-random-secret-key-here-12345
```

Redeploy the app.

## How it works

When `CPANEL_STORAGE_URL` is set **and** the app is running on Vercel:
- All file writes (`writeStorage`) upload to your cPanel via the PHP API
- All file reads (`readStorage` / `streamStorage`) fetch from your cPanel
- File deletes (`deleteStorage`) call the PHP delete endpoint
- The local `/tmp` fallback is bypassed entirely

When **not** on Vercel (local dev) or env vars are missing:
- Files are written/read from `<project>/db/...` on local disk (the original behaviour)

## API endpoints (PHP script)

All require `X-Storage-Key` header except `health`:

| Method | Action | Description |
|--------|--------|-------------|
| `POST` | `upload&path=rel/path.zip` | Store a file. Body = raw bytes. |
| `GET`  | `download&path=rel/path.zip` | Stream a file back. |
| `HEAD` | `download&path=rel/path.zip` | Existence check (no body). |
| `GET`  | `exists&path=rel/path.zip` | JSON `{exists:true, size:N}`. |
| `DELETE` | `delete&path=rel/path.zip` | Delete one file (idempotent). |
| `POST` | `delete-bulk` | Body `{paths:[...]}`. Returns `{deleted:N}`. |
| `GET`  | `list&prefix=optional/` | JSON `{files:[{path,size,modified}]}`. |
| `GET`  | `health` | No auth. `{ok,version,bytesUsed,fileCount}`. |

## File layout on cPanel

Files are stored under `storage-data/` with this structure:
```
storage-data/
├── uploads/           # build source zips + Kotlin project zips
│   ├── source-<buildId>.zip
│   └── build-<timestamp>-<random>.zip
├── apks/              # built APK artifacts (downloaded from GitHub Actions)
│   └── com.app-v1-abc123.apk
├── app-releases/      # admin-published ApkForge app releases
│   └── apkforge-v2.3-1234567890.apk
└── push-images/       # push notification images
    └── banner.png
```

## Security

- The secret key must be sent on every request (except `health`)
- Paths are sanitised: only `[A-Za-z0-9._-/]` allowed, no `..`, no leading `/`, no hidden files
- The script never serves files outside `storage-data/`
- 100 MB upload limit (adjustable via `MAX_BYTES` in `storage.php`)
- Atomic writes (temp file + rename) — no partial files on crash

## Limits to be aware of

- **PHP upload_max_filesize** — check your cPanel `php.ini`. Default is often 2-8 MB. For 100 MB uploads, set:
  ```ini
  upload_max_filesize = 100M
  post_max_size = 100M
  ```
- **Vercel function timeout** — 10s on Hobby, 60s on Pro. Large APK uploads (>50 MB) may time out on Hobby plan.
- **cPanel bandwidth** — your hosting plan's monthly bandwidth applies to all downloads.

## Troubleshooting

**"Storage key not configured"** on health endpoint → edit `storage.php` and set `STORAGE_KEY`.

**401 Unauthorized** → the `X-Storage-Key` header doesn't match `STORAGE_KEY` in the PHP file.

**413 File too large** → edit `MAX_BYTES` in `storage.php` and your cPanel `php.ini` `upload_max_filesize`.

**Builds fail with "Source zip not available"** → check `CPANEL_STORAGE_URL` and `CPANEL_STORAGE_KEY` are set in Vercel env vars and the script is reachable.

**APK download returns 500** → the APK file isn't on cPanel. This happens if the build completed on a previous Vercel instance that has since cold-started. Re-run the build — the new APK will be persisted to cPanel.

## Files in this directory

- `storage.php` — the PHP API script (upload to cPanel)
- `README.md` — this file
