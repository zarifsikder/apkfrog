import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { getOrCreateSourceZip } from '@/lib/github-build'
import { streamStorage, isRemoteStorage } from '@/lib/remote-storage'
import { readFile } from 'fs/promises'

type Params = { params: Promise<{ id: string }> }

/**
 * Serves the generated Gradle project zip for a build.
 * Auth: either the per-build `?secret=` (GitHub runner fetches this),
 * or the build owner's session (for manual inspection).
 *
 * Streams from cPanel (Vercel) or local disk (dev).
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
    // Ensure the source zip exists (regenerate if needed — handles Vercel cold starts)
    const generated = await getOrCreateSourceZip(build)
    let zipPath = generated.zipPath
    if (!build.sourceZip) {
      await db.build.update({ where: { id }, data: { sourceZip: zipPath } }).catch(() => {})
    }

    // Stream the file — from cPanel if remote storage is active, else disk
    if (isRemoteStorage() && !zipPath.startsWith('/')) {
      // Remote storage — zipPath is a relative path like "uploads/source-xyz.zip"
      const streamed = await streamStorage(zipPath)
      if (!streamed) {
        return NextResponse.json({ error: 'Source zip not available' }, { status: 500 })
      }
      return new NextResponse(streamed.body, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="apkforge-source-${id}.zip"`,
          'Content-Length': String(streamed.size),
          'Cache-Control': 'no-store',
        },
      })
    }

    // Local disk — zipPath is an absolute path
    const buf = await readFile(zipPath)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="apkforge-source-${id}.zip"`,
        'Content-Length': String(buf.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: 'Source zip not available', detail: msg }, { status: 500 })
  }
}
