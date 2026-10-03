import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { finalizeGithubSuccess } from '@/lib/github-build'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

/**
 * Webhook endpoint called by the GitHub Actions workflow when a build finishes.
 *
 * Auth: header "X-Build-Secret: <build.sourceSecret>" and body
 * { status: 'success'|'failed', run_id, artifact_name?, size_bytes?, error? }
 *
 * The website also polls GitHub directly, so this callback is an optimization —
 * both paths are idempotent.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const body = await req.json()
    const build = await db.build.findUnique({ where: { id } })
    if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
    if (build.status === 'canceled') return NextResponse.json({ ok: true, ignored: true })

    const headerSecret = req.headers.get('x-build-secret') || ''
    if (!build.sourceSecret || headerSecret !== build.sourceSecret) {
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
    }

    if (body.status === 'success') {
      // download the APK artifact now and mark success (idempotent)
      if (build.artifactName && body.artifact_name) {
        await db.build.update({ where: { id }, data: { artifactName: String(body.artifact_name).slice(0, 120) } })
      }
      try {
        await finalizeGithubSuccess(id, { artifactName: body.artifact_name || undefined })
        publish('builds', { action: 'status', id, status: 'success' }, build.userId)
        return NextResponse.json({ ok: true })
      } catch (e) {
        // polling path will retry the artifact download
        return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'artifact download failed' }, { status: 202 })
      }
    } else {
      let errMsg = body.error || 'Build failed on the build runner'
      if (typeof errMsg === 'string' && errMsg.length > 100) {
        // gradle log tail → extract the meaningful error lines
        const lines = errMsg.split('\n')
        const errIdx = lines.map((l: string, i: number) => (/\berror:/i.test(l) ? i : -1)).filter((i: number) => i >= 0)
        errMsg = errIdx.length ? lines.slice(errIdx[0], errIdx[0] + 6).join('\n') : lines.slice(-6).join('\n')
      }
      await db.build.update({
        where: { id },
        data: { status: 'failed', error: String(errMsg).slice(0, 500), completedAt: new Date() },
      })
      publish('builds', { action: 'status', id, status: 'failed' }, build.userId)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
  }
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const build = await db.build.findUnique({ where: { id }, select: { status: true } })
  return NextResponse.json({ status: build?.status || 'unknown' })
}
