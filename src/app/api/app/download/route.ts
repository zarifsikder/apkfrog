import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'
import { storagePath } from '@/lib/storage-path'
import { streamStorage, isRemoteStorage } from '@/lib/remote-storage'

const RELEASES_DIR = storagePath('app-releases')

// Public: download the latest published app APK (no login needed)
export async function GET(req: NextRequest) {
  const release = await db.appRelease.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!release) {
    return NextResponse.json({ error: 'No app release published yet' }, { status: 404 })
  }

  // Bump download counter (best-effort, non-blocking)
  db.appRelease.update({ where: { id: release.id }, data: { downloads: { increment: 1 } } }).catch(() => {})

  try {
    // Remote storage (cPanel) — fetch and stream
    if (isRemoteStorage()) {
      const relPath = `app-releases/${release.fileName}`
      const streamed = await streamStorage(relPath)
      if (!streamed) {
        return NextResponse.json({ error: 'APK file missing on remote storage' }, { status: 500 })
      }
      return new NextResponse(streamed.body, {
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': `attachment; filename="${release.fileName}"`,
          'Content-Length': String(streamed.size),
          'Cache-Control': 'no-store',
        },
      })
    }

    // Local disk
    const buf = await readFile(path.join(RELEASES_DIR, release.fileName))
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${release.fileName}"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch {
    return NextResponse.json({ error: 'APK file missing on server' }, { status: 500 })
  }
}
