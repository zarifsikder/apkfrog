import { mkdir, writeFile, readFile, unlink, access } from 'fs/promises'
import path from 'path'
import { storagePath, isVercel } from './storage-path'

/**
 * Remote persistent storage backed by a cPanel-hosted PHP API.
 *
 * On Vercel the local /tmp filesystem is ephemeral (wiped per cold start), so
 * build source zips, APK artifacts, app release APKs and push images would
 * disappear between requests. To make these persistent we proxy all writes
 * through a tiny PHP script (cpanel-storage/storage.php) that stores files
 * on a cPanel hosting account you already own — completely free, no
 * provider lock-in, no S3 setup.
 *
 * Configuration (Vercel env vars):
 *   CPANEL_STORAGE_URL     — e.g. https://yourdomain.com/storage.php
 *   CPANEL_STORAGE_KEY     — the secret key you set inside storage.php
 *
 * If CPANEL_STORAGE_URL is not set, the helper falls back to writing to
 * local disk (storagePath()) — useful for local dev without a cPanel.
 */

const REMOTE_URL = process.env.CPANEL_STORAGE_URL || ''
const REMOTE_KEY = process.env.CPANEL_STORAGE_KEY || ''

const remoteEnabled = isVercel() && !!REMOTE_URL && !!REMOTE_KEY

/**
 * Write a buffer to persistent storage.
 *
 * On Vercel + cPanel:  uploads the bytes via the PHP API
 * In dev / no config:  writes to local disk (storagePath())
 *
 * Returns the *logical* path that can be passed back to readStorage() /
 * deleteStorage() / storageDownloadUrl().
 */
export async function writeStorage(relPath: string, data: Buffer): Promise<string> {
  if (remoteEnabled) {
    const url = `${REMOTE_URL}?action=upload&path=${encodeURIComponent(relPath)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Storage-Key': REMOTE_KEY,
      },
      body: data,
      // Vercel serverless function timeout is 10s (Hobby) or 60s (Pro)
      // — give large uploads some room
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`cPanel upload failed (${res.status}) for ${relPath}: ${txt.slice(0, 200)}`)
    }
    return relPath
  }
  // Local fallback
  const local = storagePath(relPath)
  await mkdir(path.dirname(local), { recursive: true })
  await writeFile(local, data)
  return local
}

/**
 * Read a file from persistent storage. Returns the raw bytes.
 *
 * On Vercel + cPanel:  fetches the bytes from the PHP API
 * In dev / no config:  reads from local disk
 *
 * Throws if the file does not exist.
 */
export async function readStorage(relPath: string): Promise<Buffer> {
  if (remoteEnabled) {
    const url = `${REMOTE_URL}?action=download&path=${encodeURIComponent(relPath)}`
    const res = await fetch(url, {
      headers: { 'X-Storage-Key': REMOTE_KEY },
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok) {
      throw new Error(`cPanel download failed (${res.status}) for ${relPath}`)
    }
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  }
  const local = storagePath(relPath)
  return readFile(local)
}

/**
 * Check whether a file exists in persistent storage.
 */
export async function existsStorage(relPath: string): Promise<boolean> {
  if (remoteEnabled) {
    const url = `${REMOTE_URL}?action=exists&path=${encodeURIComponent(relPath)}`
    try {
      const res = await fetch(url, {
        headers: { 'X-Storage-Key': REMOTE_KEY },
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) return false
      const d = (await res.json()) as { exists?: boolean }
      return !!d.exists
    } catch {
      return false
    }
  }
  try {
    const local = storagePath(relPath)
    await access(local)
    return true
  } catch {
    return false
  }
}

/**
 * Delete a file from persistent storage. Idempotent — deleting a non-existent
 * file is not an error.
 */
export async function deleteStorage(relPath: string): Promise<void> {
  if (remoteEnabled) {
    const url = `${REMOTE_URL}?action=delete&path=${encodeURIComponent(relPath)}`
    try {
      await fetch(url, {
        method: 'DELETE',
        headers: { 'X-Storage-Key': REMOTE_KEY },
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      /* best-effort */
    }
    return
  }
  try {
    await unlink(storagePath(relPath))
  } catch {
    /* already gone — fine */
  }
}

/**
 * Get a public-ish URL that streams the file from persistent storage.
 *
 * On Vercel + cPanel:  returns the PHP download URL with the storage key
 *                      embedded. SAFE for server-side fetch() only — the
 *                      key would leak in the browser. For browser-facing
 *                      downloads, use a Next.js API route that proxies the
 *                      fetch server-side (see buildSourceDownloadHandler).
 * In dev / no config:  returns a local file:// URL (not actually used).
 */
export function storageDownloadUrl(relPath: string): string {
  if (remoteEnabled) {
    // For SERVER-SIDE use only — includes the secret key
    return `${REMOTE_URL}?action=download&path=${encodeURIComponent(relPath)}&key=${encodeURIComponent(REMOTE_KEY)}`
  }
  return `file://${storagePath(relPath)}`
}

/**
 * Ping the cPanel storage host. Returns { ok, version, bytesUsed, fileCount }
 * or null if remote storage is not configured.
 *
 * Used by the admin health-check panel and at boot to verify connectivity.
 */
export async function pingRemoteStorage(): Promise<{ ok: boolean; version?: string; bytesUsed?: number; fileCount?: number; error?: string } | null> {
  if (!REMOTE_URL) return null
  try {
    const res = await fetch(`${REMOTE_URL}?action=health`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const d = (await res.json()) as { ok: boolean; version?: string; bytesUsed?: number; fileCount?: number }
    return d
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' }
  }
}

/**
 * Is remote (cPanel) storage currently active? (Vercel + env vars set)
 */
export function isRemoteStorage(): boolean {
  return remoteEnabled
}

/**
 * Get a streamable Response body for a file in persistent storage — used by
 * Next.js API routes that need to pipe a download to the client (e.g. the
 * APK download route).
 *
 * Returns { body, headers } ready to wrap in `new NextResponse(body, { headers })`.
 */
export async function streamStorage(relPath: string): Promise<{ body: ReadableStream<Uint8Array>; size: number; mime: string } | null> {
  if (remoteEnabled) {
    const url = `${REMOTE_URL}?action=download&path=${encodeURIComponent(relPath)}`
    const res = await fetch(url, {
      headers: { 'X-Storage-Key': REMOTE_KEY },
      signal: AbortSignal.timeout(55000),
    })
    if (!res.ok || !res.body) return null
    const size = parseInt(res.headers.get('content-length') || '0', 10)
    const mime = res.headers.get('content-type') || 'application/octet-stream'
    // res.body is a web ReadableStream — Next.js can stream it directly
    return { body: res.body as ReadableStream<Uint8Array>, size, mime }
  }
  // Local fallback — read from disk
  try {
    const local = storagePath(relPath)
    const buf = await readFile(local)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(buf)
        controller.close()
      },
    })
    const ext = path.extname(relPath).slice(1).toLowerCase()
    const mimes: Record<string, string> = {
      zip: 'application/zip',
      apk: 'application/vnd.android.package-archive',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      json: 'application/json',
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
    }
    return { body: stream, size: buf.length, mime: mimes[ext] || 'application/octet-stream' }
  } catch {
    return null
  }
}
