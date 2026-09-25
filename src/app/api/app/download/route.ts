import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'

const RELEASES_DIR = path.join(process.cwd(), 'db', 'app-releases')

// Public: download the latest published app APK (no login needed)
export async function GET(req: NextRequest) {
  const release = await db.appRelease.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!release) {
    return NextResponse.json({ error: 'No app release published yet' }, { status: 404 })
  }
  try {
    const buf = await readFile(path.join(RELEASES_DIR, release.fileName))
    // fire-and-forget download counter
    db.appRelease
      .update({ where: { id: release.id }, data: { downloads: { increment: 1 } } })
      .catch(() => {})
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="ApkForge-v${release.versionName}.apk"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'APK file missing on server' }, { status: 500 })
  }
}
