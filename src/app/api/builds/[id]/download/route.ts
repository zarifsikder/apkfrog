import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { readFile } from 'fs/promises'

type Params = { params: Promise<{ id: string }> }

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
    const buf = await readFile(build.apkPath)
    const safeName = build.appName.replace(/[^a-zA-Z0-9._-]/g, '_')
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${safeName}-v${build.versionName}.apk"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch {
    return NextResponse.json({ error: 'APK file missing on server' }, { status: 500 })
  }
}
