import { NextRequest, NextResponse } from 'next/server'
import { getUser, unauthorized } from '@/lib/auth'
import { getGithubConfig } from '@/lib/github-config'
import { setupGithubBuildRepo } from '@/lib/github-build'
import { publish } from '@/lib/events'

/**
 * One-time setup: verifies the token, creates the build repo if missing,
 * installs/updates .github/workflows/wevlo-build.yml.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  try {
    const body = await req.json().catch(() => ({}))
    const cfg = await getGithubConfig()
    if (!cfg) {
      return NextResponse.json({ error: 'Save your token and repo name first, then run Setup' }, { status: 400 })
    }
    const result = await setupGithubBuildRepo(cfg, { createIfMissing: body.createIfMissing !== false })
    publish('engine', { action: 'setup', login: result.login }, user.id)
    return NextResponse.json({
      ok: true,
      login: result.login,
      createdRepo: result.createdRepo,
      repoUrl: result.repoUrl,
      defaultBranch: result.defaultBranch,
      workflowUpdated: result.workflowUpdated,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'GitHub setup failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
