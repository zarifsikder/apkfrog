import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { streamStorage, isRemoteStorage } from '@/lib/remote-storage'
import { readFile } from 'fs/promises'

type Params = { params: Promise<{ id: string }> }

/**
 * Streams the built APK to the user.
 *
 * On Vercel + cPanel:  streams from cPanel storage (build.apkPath is a
 *                      relative path like "apks/com.app-v1-abc123.apk")
 * In dev:              reads from local disk (build.apkPath is absolute)
 */
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const build = await db.build.findFirst({ where: { id, userId: user.id } })
  if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  if (build.status !== 'success' || !build.apkPath) {
    return NextResponse.json({ error: 'APK is not ready yet' }, { status: 400 })
  }

  try {
    const safeName = build.appName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filename = `${safeName}-v${build.versionName}.apk`

    // Remote storage (cPanel) — build.apkPath is a relative path
    if (isRemoteStorage() && !build.apkPath.startsWith('/')) {
      const streamed = await streamStorage(build.apkPath)
      if (!streamed) {
        return NextResponse.json({ error: 'APK file missing on remote storage' }, { status: 500 })
      }
      return new NextResponse(streamed.body, {
        headers: {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(streamed.size),
          'Cache-Control': 'no-store',
        },
      })
    }

    // Local disk — build.apkPath is an absolute path
    const buf = await readFile(build.apkPath)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch {
    return NextResponse.json({ error: 'APK file missing on server' }, { status: 500 })
  }
}
