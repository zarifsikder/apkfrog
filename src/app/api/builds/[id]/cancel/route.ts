import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { cancelGithubRun } from '@/lib/github-build'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const build = await db.build.findFirst({ where: { id, userId: user.id } })
  if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  if (build.status === 'success' || build.status === 'failed') {
    return NextResponse.json({ error: 'Build already finished' }, { status: 400 })
  }
  if (build.provider === 'github' && build.runId) {
    await cancelGithubRun(id)
  }
  const updated = await db.build.update({
    where: { id },
    data: {
      status: 'canceled',
      error: 'Build canceled by user',
      completedAt: new Date(),
      logs: build.logs + '\n[github] ✗ Build canceled by user request\n',
    },
  })
  publish('builds', { action: 'status', id, status: 'canceled' }, user.id)
  return NextResponse.json({ build: updated })
}
