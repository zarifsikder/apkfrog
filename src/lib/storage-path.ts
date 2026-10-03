import path from 'path'
import { tmpdir } from 'os'

/**
 * Centralised writable-storage path resolver.
 *
 * Vercel serverless functions run with a READ-ONLY filesystem except for `/tmp`
 * (which is a per-invocation ephemeral directory — unique to each cold start,
 * but shared across warm invocations on the same instance). Anything we write
 * to disk at runtime (build source zips, downloaded APK artifacts, uploaded
 * release APKs, push notification images, default app icons) MUST live under
 * `/tmp` on Vercel, otherwise we hit `ENOENT: no such file or directory, mkdir
 * '/var/task/db'`.
 *
 * In local dev (`npm run dev`) we still write to `<cwd>/db/...` so the files
 * are easy to inspect and survive across server restarts.
 *
 * Detection:
 *   • `process.env.VERCEL` is set to `'1'` by Vercel's build/runtime
 *   • `process.env.NOW_REGION` is set by Vercel's older runtime
 *   • Falls back to `/tmp` if `process.cwd()` is not writable (defensive)
 */

const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.NOW_REGION

function root(): string {
  if (IS_VERCEL) {
    // /tmp is the only writable directory on Vercel serverless.
    // We namespace under /tmp/apkforge to avoid colliding with other
    // serverless functions in the same project.
    return path.join('/tmp', 'apkforge')
  }
  // Local dev — keep using <cwd>/db for backwards compat + easy inspection
  return path.join(process.cwd(), 'db')
}

/**
 * Resolve a writable subdirectory under the runtime storage root.
 * The directory is NOT created here — callers should `mkdir(p, { recursive: true })`
 * before writing.
 *
 * Examples:
 *   storagePath('uploads')        → '/tmp/apkforge/uploads'  (Vercel)
 *                                  → '<cwd>/db/uploads'       (dev)
 *   storagePath('apks', 'x.apk')  → '/tmp/apkforge/apks/x.apk'
 */
export function storagePath(sub: string, ...segments: string[]): string {
  return path.join(root(), sub, ...segments)
}

/** Convenience: the root storage directory itself. */
export function storageRoot(): string {
  return root()
}

/** True when running on Vercel serverless (read-only cwd, writable /tmp). */
export function isVercel(): boolean {
  return IS_VERCEL
}
