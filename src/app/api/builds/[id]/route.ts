import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { syncGithubBuild } from '@/lib/github-build'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  let build = await db.build.findFirst({ where: { id, userId: user.id } })
  if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })

  // GitHub builds are driven by polling: every status request also syncs from GitHub
  // (internally throttled to ~4s per build, so hammering the endpoint is safe)
  if (build.provider === 'github' && ['queued', 'building'].includes(build.status)) {
    await syncGithubBuild(build.id).catch(() => {})
    build = await db.build.findFirst({ where: { id, userId: user.id } })
  }
  return NextResponse.json({ build })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const build = await db.build.findFirst({ where: { id, userId: user.id } })
  if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  await db.build.delete({ where: { id } })
  publish('builds', { action: 'delete', id }, user.id)
  return NextResponse.json({ ok: true })
}
