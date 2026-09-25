import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { getOrCreateSourceZip } from '@/lib/github-build'
import { readFile } from 'fs/promises'

type Params = { params: Promise<{ id: string }> }

/**
 * Serves the generated Gradle project zip for a build.
 * Auth: either the per-build `?secret=` (GitHub runner fetches this),
 * or the build owner's session (for manual inspection).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const build = await db.build.findUnique({ where: { id }, include: { project: { include: { files: true } } } })
  if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })

  const secret = req.nextUrl.searchParams.get('secret') || ''
  const secretOk = build.sourceSecret && secret && secret === build.sourceSecret
  if (!secretOk) {
    const user = await getUser(req)
    if (!user || user.id !== build.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    let zipPath = build.sourceZip
    if (!zipPath) {
      const generated = await getOrCreateSourceZip(build)
      zipPath = generated.zipPath
      await db.build.update({ where: { id }, data: { sourceZip: zipPath } }).catch(() => {})
    }
    const buf = await readFile(zipPath)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="apkforge-source-${id}.zip"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Source zip not available' }, { status: 500 })
  }
}
