import { NextRequest, NextResponse } from 'next/server'
import { readFile, stat } from 'fs/promises'
import { join, normalize, sep } from 'path'

/**
 * GET /download/[file]
 *
 * Serves files ONLY from the project's `download/` directory.
 * Any attempt to escape (path traversal) returns 403.
 * Any file outside `download/` returns 404.
 *
 * Examples:
 *   /download/apkforge-vercel.zip  → downloads the production zip
 *   /download/apkforge_schema.sql  → downloads the MySQL schema
 *   /download/DEPLOYMENT.md        → downloads the deployment guide
 */

const DOWNLOAD_DIR = join(process.cwd(), 'download')

// Whitelist of allowed file extensions (defense in depth)
const ALLOWED_EXT = new Set([
  '.zip', '.sql', '.md', '.txt', '.pdf', '.json', '.csv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.apk', '.js', '.ts', '.html', '.css',
])

const MIME: Record<string, string> = {
  '.zip': 'application/zip',
  '.sql': 'application/sql',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.apk': 'application/vnd.android.package-archive',
  '.js': 'text/javascript; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params

  // ── Security: validate filename ──
  // Must be a simple filename — no path separators, no parent refs, no hidden files
  if (!file || typeof file !== 'string') {
    return NextResponse.json({ error: 'File not specified' }, { status: 400 })
  }

  // Block path traversal attempts
  if (file.includes('..') || file.includes('/') || file.includes('\\') || file.startsWith('.')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Must contain a valid extension
  const lower = file.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf('.'))
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 403 })
  }

  // Resolve and verify it's still inside DOWNLOAD_DIR (defense in depth)
  const target = normalize(join(DOWNLOAD_DIR, file))
  if (!target.startsWith(DOWNLOAD_DIR + sep) && target !== DOWNLOAD_DIR) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Read the file ──
  let data: Buffer
  try {
    const info = await stat(target)
    if (!info.isFile()) {
      return NextResponse.json({ error: 'Not a file' }, { status: 404 })
    }
    data = await readFile(target)
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // ── Send as attachment (force download) ──
  const contentType = MIME[ext] || 'application/octet-stream'
  // For .md and .txt we serve inline (so the user can read in browser)
  // For .zip, .sql, .apk etc. we force download
  const forceDownload = !['.md', '.txt', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)
  const disposition = forceDownload ? 'attachment' : 'inline'

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(data.length),
      'Content-Disposition': `${disposition}; filename="${file}"`,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
