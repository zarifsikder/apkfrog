import JSZip from 'jszip'
import { randomBytes } from 'crypto'
import { writeFile, readFile, mkdir } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { publish } from '@/lib/events'
import { getGithubConfig, type GithubConfig } from './github-config'
import { buildWorkflowYaml, WORKFLOW_PATH } from './workflow-yaml'
import { generateGradleProjectZip } from './gradle-project'

/**
 * GitHub Actions build orchestrator.
 *
 * 1. ensure the build repo + wevlo-build.yml workflow exist (cached)
 * 2. generate the Gradle project zip for the build and host it at
 *    /api/builds/{id}/source?secret=…
 * 3. dispatch the workflow (workflow_dispatch) with signed inputs
 * 4. track the run (find run id → poll status/jobs → map to console steps)
 * 5. on success download the APK artifact into db/apks and mark the build done
 * 6. the workflow also POSTs a callback — both paths are idempotent
 */

const API = 'https://api.github.com'
const WORKFLOW_FILE = WORKFLOW_PATH
const RUN_POLL_MS = 7000
const SYNC_MIN_MS = 4000
const LOG_SYNC_MS = 25000
const MAX_BUILD_MS = 35 * 60 * 1000

class GithubApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

class GithubConfigError extends Error {}

async function ghApi<T = any>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ApkForge-Builder',
      Authorization: `Bearer ${token}`,
      ...(init.body && !(init.headers as any)?.['Content-Type'] ? { 'Content-Type': 'application/json' } : {}),
      ...((init.headers as Record<string, string>) || {}),
    },
    signal: AbortSignal.timeout(45000),
    cache: 'no-store',
  })
  if (!res.ok) {
    let msg = ''
    try {
      const j = await res.json()
      msg = j.message || ''
      if (Array.isArray(j.errors)) msg += (msg ? ' — ' : '') + j.errors.map((e: any) => e.message || String(e)).join('; ')
    } catch {
      msg = res.statusText
    }
    throw new GithubApiError(res.status, msg)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

async function ghBinary(token: string, path: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ApkForge-Builder',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(120000),
    redirect: 'follow',
    cache: 'no-store',
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      msg = (await res.json()).message || msg
    } catch {}
    throw new GithubApiError(res.status, msg)
  }
  return res.arrayBuffer()
}

// ---------------------------------------------------------------------------
// logging helpers
// ---------------------------------------------------------------------------
async function appendLog(buildId: string, line: string, patch: Record<string, unknown> = {}) {
  try {
    const b = await db.build.findUnique({ where: { id: buildId }, select: { logs: true, status: true } })
    if (!b) return
    const logs = (b.logs + line + '\n').slice(-9000)
    await db.build.update({ where: { id: buildId }, data: { logs, ...patch } })
  } catch {
    /* build row may be gone */
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// repo + workflow setup (cached for 10 min)
// ---------------------------------------------------------------------------
interface RepoInfo {
  defaultBranch: string
  htmlUrl: string
  workflowOk: boolean
}

const repoCache = new Map<string, { info: RepoInfo; at: number }>()
const REPO_CACHE_TTL = 10 * 60 * 1000

export async function ensureBuildRepo(cfg: GithubConfig, opts: { force?: boolean } = {}): Promise<RepoInfo> {
  const cached = repoCache.get(cfg.repo)
  if (!opts.force && cached && Date.now() - cached.at < REPO_CACHE_TTL) return cached.info

  let repo: any
  try {
    repo = await ghApi(cfg.token, `/repos/${cfg.repo}`)
  } catch (e) {
    if (e instanceof GithubApiError && e.status === 404) {
      throw new GithubConfigError(
        `Build repo "${cfg.repo}" not found (or the token can't see it). Open More → GitHub Builds and press "Create repo & install workflow".`
      )
    }
    throw e
  }

  const defaultBranch = repo.default_branch || 'main'
  const htmlUrl = repo.html_url as string

  // does the workflow exist and match the current version?
  let workflowOk = false
  let sha: string | undefined
  try {
    const wf = await ghApi<any>(cfg.token, `/repos/${cfg.repo}/contents/${WORKFLOW_FILE}?ref=${encodeURIComponent(defaultBranch)}`)
    sha = wf.sha
    const content = Buffer.from(wf.content || '', 'base64').toString('utf8')
    workflowOk = content.trim() === buildWorkflowYaml().trim()
  } catch (e) {
    if (e instanceof GithubApiError && e.status === 404) workflowOk = false
    else throw e
  }

  if (!workflowOk) {
    const content = Buffer.from(buildWorkflowYaml()).toString('base64')
    try {
      await ghApi(cfg.token, `/repos/${cfg.repo}/contents/${WORKFLOW_FILE}`, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'ApkForge: install/update APK build workflow',
          content,
          branch: defaultBranch,
          ...(sha ? { sha } : {}),
        }),
      })
      workflowOk = true
    } catch (e) {
      if (e instanceof GithubApiError && (e.status === 403 || e.status === 404)) {
        throw new GithubConfigError(
          `Could not write the workflow file (HTTP ${e.status}). Your token is missing the "workflow" scope — classic PAT needs repo + workflow scopes; fine-grained PAT needs Contents: Read and write. ${e.message}`
        )
      }
      throw e
    }
  }

  const info: RepoInfo = { defaultBranch, htmlUrl, workflowOk }
  repoCache.set(cfg.repo, { info, at: Date.now() })
  return info
}

// ---------------------------------------------------------------------------
// source zip
// ---------------------------------------------------------------------------
export async function getOrCreateSourceZip(build: {
  id: string
  appName: string
  packageName: string
  versionName: string
  versionCode: number
  sourceType: string
  sourceMode: string
  websiteUrl?: string | null
  zipPath?: string | null
  config: string
  serverUrl?: string | null
  sourceZip?: string | null
  project?: { files: Array<{ path: string; content: string }> } | null
}, serverUrl?: string | null): Promise<{ zipPath: string; notes: string[] }> {
  const target = path.join(process.cwd(), 'db', 'uploads', `source-${build.id}.zip`)
  if (build.sourceZip === target) {
    try {
      await readFile(target)
      return { zipPath: target, notes: [] }
    } catch {
      /* regenerate */
    }
  }
  const { zip, notes } = await generateGradleProjectZip({ ...build, serverUrl: serverUrl || build.serverUrl || null })
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, zip)
  return { zipPath: target, notes }
}

// ---------------------------------------------------------------------------
// run discovery + progress mapping
// ---------------------------------------------------------------------------
async function findDispatchedRun(cfg: GithubConfig, build: { id: string; dispatchedAt: Date | null; runId: string | null }) {
  const runs = await ghApi<any>(cfg.token, `/repos/${cfg.repo}/actions/workflows/${WORKFLOW_FILE.split('/').pop()}/runs?per_page=10`)
  const used = new Set(
    (await db.build.findMany({ where: { provider: 'github', runId: { not: null } }, select: { runId: true } })).map((b) => b.runId)
  )
  const since = build.dispatchedAt ? build.dispatchedAt.getTime() - 180000 : Date.now() - 10 * 60 * 1000
  const candidates = (runs.workflow_runs || [])
    .filter((r: any) => !used.has(String(r.id)))
    .filter((r: any) => {
      const title = String(r.display_title || '')
      if (title.includes(build.id)) return true
      return new Date(r.created_at).getTime() >= since && r.event === 'workflow_dispatch'
    })
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return candidates[0] || null
}

function mapProgress(jobs: any[]): { step: string; progress: number } {
  const steps = jobs?.[0]?.steps || []
  const total = steps.length || 1
  const completed = steps.filter((s: any) => s.status === 'completed').length
  const active = steps.find((s: any) => s.status === 'in_progress') || steps[completed] || null
  const name = String(active?.name || '').toLowerCase()
  let step = 'Package'
  if (/download|unzip|source/.test(name)) step = 'Configure'
  else if (/jdk|gradle|license|setup job/.test(name)) step = 'Connect'
  else if (/collect|upload/.test(name)) step = 'Sign'
  else if (/notify/.test(name)) step = 'Done'
  const progress = Math.max(10, Math.min(97, 10 + Math.round((85 * completed) / total)))
  return { step, progress }
}

function extractError(log: string): string {
  const lines = log.split('\n')
  const errIdx = lines.map((l, i) => (/\berror:/i.test(l) ? i : -1)).filter((i) => i >= 0)
  if (errIdx.length) return lines.slice(errIdx[0], errIdx[0] + 6).join('\n').slice(0, 500)
  const failIdx = lines.findIndex((l) => /BUILD FAILED|Execution failed for task/i.test(l))
  if (failIdx >= 0) return lines.slice(failIdx, failIdx + 6).join('\n').slice(0, 500)
  return lines.slice(-8).join('\n').slice(0, 500)
}

async function fetchRunLogTail(cfg: GithubConfig, runId: string): Promise<string | null> {
  try {
    const buf = await ghBinary(cfg.token, `/repos/${cfg.repo}/actions/runs/${runId}/logs`)
    const zip = await JSZip.loadAsync(buf)
    const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort()
    let all = ''
    for (const n of names) {
      all += (await zip.files[n].async('string')) + '\n'
      if (all.length > 400000) break
    }
    return all.slice(-8000)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// artifact → APK
// ---------------------------------------------------------------------------
export async function finalizeGithubSuccess(buildId: string, opts: { artifactName?: string } = {}) {
  const build = await db.build.findUnique({ where: { id: buildId } })
  if (!build) return
  if (build.status === 'success' && build.apkPath) return
  if (build.status === 'canceled') return
  const cfg = await getGithubConfig()
  if (!cfg) throw new GithubConfigError('GitHub config disappeared mid-build')

  const artifactName = opts.artifactName || build.artifactName || `apk-${build.id}`
  let artifact: any = null
  try {
    const list = await ghApi<any>(cfg.token, `/repos/${cfg.repo}/actions/artifacts?name=${encodeURIComponent(artifactName)}&per_page=5`)
    artifact = (list.artifacts || [])[0]
  } catch (e) {
    artifact = null
    if (e instanceof GithubApiError && e.status !== 404) throw e
  }
  if (!artifact) throw new Error(`APK artifact "${artifactName}" not found on GitHub (it may have expired)`)

  const buf = await ghBinary(cfg.token, `/repos/${cfg.repo}/actions/artifacts/${artifact.id}/zip`)
  const zip = await JSZip.loadAsync(buf)
  const apkEntry = Object.keys(zip.files).find((n) => !zip.files[n].dir && n.toLowerCase().endsWith('.apk'))
  if (!apkEntry) throw new Error('Artifact zip did not contain an APK file')
  const apkBuf = await zip.files[apkEntry].async('nodebuffer')

  const APK_DIR = path.join(process.cwd(), 'db', 'apks')
  await mkdir(APK_DIR, { recursive: true })
  const safeName = build.packageName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const apkPath = path.join(APK_DIR, `${safeName}-v${build.versionCode}-${build.id.slice(-6)}.apk`)
  await writeFile(apkPath, apkBuf)
  const kb = apkBuf.length / 1024
  const apkSize = kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`

  await db.build.update({
    where: { id: buildId },
    data: {
      status: 'success',
      progress: 100,
      currentStep: 'Done',
      apkPath,
      apkSize,
      completedAt: new Date(),
      logs: (build.logs + `[github] APK artifact downloaded ✓ (${apkSize})\n[github] REAL installable APK built by GitHub Actions 🎉\n`).slice(-9000),
    },
  })
  publish('builds', { action: 'status', id: buildId, status: 'success' }, build.userId)
  await db.notification
    .create({
      data: {
        userId: build.userId,
        title: 'APK Ready 🎉',
        body: `"${build.appName}" v${build.versionName} was built by GitHub Actions. Download it now.`,
      },
    })
    .catch(() => {})
  publish('notifications', { action: 'new' }, build.userId)
}

// ---------------------------------------------------------------------------
// sync (called by build status route + orchestrator loop)
// ---------------------------------------------------------------------------
const activeSync = new Set<string>()

export async function syncGithubBuild(buildId: string, opts: { force?: boolean } = {}): Promise<boolean> {
  // returns true when the build reached a terminal state
  const existing = await db.build.findUnique({ where: { id: buildId } })
  if (!existing || existing.provider !== 'github') return true
  if (['success', 'failed', 'canceled'].includes(existing.status)) return true
  if (!opts.force && existing.syncedAt && Date.now() - existing.syncedAt.getTime() < SYNC_MIN_MS) return false
  if (activeSync.has(buildId)) return false
  activeSync.add(buildId)
  try {
    const build = await db.build.findUnique({ where: { id: buildId } })
    if (!build || build.provider !== 'github' || ['success', 'failed', 'canceled'].includes(build.status)) return true
    const cfg = await getGithubConfig()
    if (!cfg) {
      await appendLog(buildId, '[github] ⚠ GitHub config removed — build can no longer be tracked', {})
      return false
    }

    // attach run id if we don't have it yet
    if (!build.runId) {
      const run = await findDispatchedRun(cfg, build)
      if (!run) {
        const waited = build.dispatchedAt ? Date.now() - build.dispatchedAt.getTime() : 0
        if (waited > 5 * 60 * 1000) {
          await db.build.update({
            where: { id: buildId },
            data: { status: 'failed', error: 'GitHub Actions run was never created (dispatch may have failed)', completedAt: new Date() },
          })
          return true
        }
        return false
      }
      await db.build.update({ where: { id: buildId }, data: { runId: String(run.id), runUrl: run.html_url } })
      await appendLog(buildId, `[github] run #${run.id} attached — ${run.html_url}`)
      build.runId = String(run.id)
    }

    const run = await ghApi<any>(cfg.token, `/repos/${cfg.repo}/actions/runs/${build.runId}`)
    await db.build.update({ where: { id: buildId }, data: { runUrl: run.html_url || build.runUrl } })

    if (run.status === 'completed') {
      if (run.conclusion === 'success') {
        try {
          await finalizeGithubSuccess(buildId)
        } catch (e: any) {
          // keep build alive so a later poll can retry artifact download
          await appendLog(buildId, `[github] artifact download failed: ${e?.message || e} — will retry`)
          return false
        }
        return true
      }
      // failure / cancelled / timed_out
      const tail = await fetchRunLogTail(cfg, build.runId)
      if (tail) await appendLog(buildId, tail.trim().split('\n').slice(-20).join('\n'))
      const errMsg = tail ? extractError(tail) : `GitHub Actions build ${run.conclusion || 'failed'}`
      await db.build.update({
        where: { id: buildId },
        data: { status: 'failed', error: errMsg.slice(0, 500), completedAt: new Date(), currentStep: 'Package' },
      })
      publish('builds', { action: 'status', id: buildId, status: 'failed' }, build.userId)
      return true
    }

    // still running — map progress from jobs
    const jobs = await ghApi<any>(cfg.token, `/repos/${cfg.repo}/actions/runs/${build.runId}/jobs?per_page=1`)
    const { step, progress } = mapProgress(jobs.jobs || [])
    const patch: Record<string, unknown> = { status: 'building', currentStep: step, progress, startedAt: build.startedAt || new Date(run.created_at) }

    // periodic log tail so the console feels alive
    if (!build.syncedAt || Date.now() - build.syncedAt.getTime() > LOG_SYNC_MS) {
      const tail = await fetchRunLogTail(cfg, build.runId)
      if (tail) {
        const fresh = tail.split('\n').slice(-12).join('\n')
        const b2 = await db.build.findUnique({ where: { id: buildId }, select: { logs: true } })
        const marker = '[gh-log] '
        const logs = ((b2?.logs || '') + fresh.split('\n').map((l) => (l.trim() ? marker + l : l)).join('\n') + '\n').slice(-9000)
        patch.logs = logs
      }
    }
    await db.build.update({ where: { id: buildId }, data: patch })
    return false
  } catch (e) {
    if (e instanceof GithubApiError && (e.status === 404 || e.status === 403)) {
      await appendLog(buildId, `[github] tracking error (HTTP ${e.status}): ${e.message}`)
    } else if (e instanceof GithubConfigError) {
      await appendLog(buildId, `[github] ${e.message}`)
    }
    return false
  } finally {
    await db.build.update({ where: { id: buildId }, data: { syncedAt: new Date() } }).catch(() => {})
    activeSync.delete(buildId)
  }
}

// ---------------------------------------------------------------------------
// orchestrator
// ---------------------------------------------------------------------------
const orchestrating = new Set<string>()

export async function startGithubBuild(buildId: string, siteOrigin: string) {
  if (orchestrating.has(buildId)) return
  orchestrating.add(buildId)
  try {
    const build = await db.build.findUnique({ where: { id: buildId }, include: { project: { include: { files: true } } } })
    if (!build) return
    const cfg = await getGithubConfig()
    if (!cfg) {
      throw new GithubConfigError(
        'GitHub Actions is not configured. Open More → GitHub Builds, paste your Personal Access Token + repo name and press Setup once.'
      )
    }
    if (!/^https?:\/\//.test(siteOrigin)) {
      throw new GithubConfigError(
        'Public site URL is missing. Open More → GitHub Builds and set "Public Site URL" so GitHub runners can download your project source.'
      )
    }
    if (/localhost|127\.0\.0\.1/.test(siteOrigin)) {
      throw new GithubConfigError(
        `"${siteOrigin}" is not reachable from GitHub runners. Set your public https:// site URL in More → GitHub Builds.`
      )
    }

    await appendLog(buildId, `[apkforge-builder] Build ${buildId.slice(-6).toUpperCase()} started for "${build.appName}"`)
    await appendLog(buildId, `[github] engine: GitHub Actions — ${cfg.repo} (real Gradle + Android SDK build)`)

    await db.build.update({
      where: { id: buildId },
      data: { provider: 'github', status: 'queued', currentStep: 'Connect', progress: 5, startedAt: new Date() },
    })

    // 1) repo + workflow ready
    const repoInfo = await ensureBuildRepo(cfg)
    await appendLog(buildId, `[github] repo ready — ${repoInfo.htmlUrl} (branch ${repoInfo.defaultBranch})`)

    // 2) source zip (serverUrl = public site origin — embedded into the APK for push notifications)
    const { zipPath, notes } = await getOrCreateSourceZip(build, siteOrigin)
    for (const n of notes) await appendLog(buildId, n)
    const zipStat = await readFile(zipPath)
    await appendLog(buildId, `[github] gradle project zip ready (${(zipStat.length / 1024).toFixed(0)} KB) → hosted at /api/builds/${buildId.slice(-6)}/source`)

    const secret = build.sourceSecret || randomBytes(16).toString('hex')
    const apkName = `${(build.appName || 'app').replace(/[^a-zA-Z0-9._-]/g, '_')}-v${build.versionName.replace(/[^a-zA-Z0-9._-]/g, '') || '1.0'}.apk`
    const artifactName = `apk-${build.id}`
    const inputs = {
      build_id: build.id,
      source_url: `${siteOrigin}/api/builds/${build.id}/source?secret=${secret}`,
      callback_url: `${siteOrigin}/api/builds/${build.id}/callback`,
      callback_secret: secret,
      apk_name: apkName,
      artifact_name: artifactName,
    }

    await db.build.update({
      where: { id: buildId },
      data: { sourceSecret: secret, sourceZip: zipPath, artifactName, status: 'queued' },
    })

    // 3) dispatch
    try {
      await ghApi(cfg.token, `/repos/${cfg.repo}/actions/workflows/${WORKFLOW_FILE.split('/').pop()}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({ ref: repoInfo.defaultBranch, inputs }),
      })
    } catch (e) {
      if (e instanceof GithubApiError && (e.status === 403 || e.status === 404)) {
        throw new GithubConfigError(
          `Dispatch rejected by GitHub (HTTP ${e.status}). The token needs Actions: Read and write (fine-grained) or repo + workflow scopes (classic). ${e.message}`
        )
      }
      throw e
    }
    await db.build.update({ where: { id: buildId }, data: { dispatchedAt: new Date(), status: 'building', currentStep: 'Connect', progress: 8 } })
    await appendLog(buildId, `[github] workflow dispatched ✓ waiting for the runner to pick it up...`)

    // 4) attach run id
    for (let i = 0; i < 24; i++) {
      await sleep(5000)
      const cur = await db.build.findUnique({ where: { id: buildId }, select: { status: true, runId: true, dispatchedAt: true } })
      if (!cur || cur.status === 'canceled') return
      if (cur.runId) break
      const run = await findDispatchedRun(cfg, { id: build.id, dispatchedAt: cur.dispatchedAt, runId: null }).catch(() => null)
      if (run) {
        await db.build.update({ where: { id: buildId }, data: { runId: String(run.id), runUrl: run.html_url } })
        await appendLog(buildId, `[github] run #${run.id} attached — ${run.html_url}`)
        break
      }
    }

    // 5) poll until terminal
    const start = Date.now()
    while (Date.now() - start < MAX_BUILD_MS) {
      await sleep(RUN_POLL_MS)
      const cur = await db.build.findUnique({ where: { id: buildId }, select: { status: true } })
      if (!cur || cur.status === 'canceled') return
      const done = await syncGithubBuild(buildId, { force: true })
      if (done) return
    }
    await db.build
      .update({
        where: { id: buildId },
        data: { status: 'failed', error: 'Build timed out after 35 minutes on GitHub Actions', completedAt: new Date() },
      })
      .catch(() => {})
    publish('builds', { action: 'status', id: buildId, status: 'failed' })
  } catch (e) {
    const msg = e instanceof GithubConfigError ? e.message : e instanceof Error ? e.message : 'GitHub build failed to start'
    await appendLog(buildId, `[github] ✗ ${msg}`)
    await db.build
      .update({
        where: { id: buildId },
        data: { status: 'failed', error: msg.slice(0, 500), completedAt: new Date() },
      })
      .catch(() => {})
    publish('builds', { action: 'status', id: buildId, status: 'failed' })
  } finally {
    orchestrating.delete(buildId)
  }
}

export async function cancelGithubRun(buildId: string) {
  const build = await db.build.findUnique({ where: { id: buildId } })
  if (!build || build.provider !== 'github' || !build.runId) return
  const cfg = await getGithubConfig()
  if (!cfg) return
  await ghApi(cfg.token, `/repos/${cfg.repo}/actions/runs/${build.runId}/cancel`, { method: 'POST' }).catch(() => {})
  await appendLog(buildId, `[github] cancel requested for run #${build.runId}`)
}

// ---------------------------------------------------------------------------
// one-time setup: verify token → create repo (optional) → push workflow
// ---------------------------------------------------------------------------
export async function setupGithubBuildRepo(
  cfg: GithubConfig,
  opts: { createIfMissing?: boolean } = {}
): Promise<{ login: string; createdRepo: boolean; repoUrl: string; defaultBranch: string; workflowUpdated: boolean }> {
  // 1) token check
  const me = await ghApi<any>(cfg.token, '/user').catch((e) => {
    if (e instanceof GithubApiError && e.status === 401) {
      throw new GithubConfigError('Invalid GitHub token (401). Generate a classic PAT with repo + workflow scopes.')
    }
    throw e
  })

  // 2) repo
  let createdRepo = false
  try {
    await ghApi(cfg.token, `/repos/${cfg.repo}`)
  } catch (e) {
    if (e instanceof GithubApiError && e.status === 404) {
      if (!opts.createIfMissing) {
        throw new GithubConfigError(`Repo "${cfg.repo}" does not exist yet (or the token can't see it).`)
      }
      const name = cfg.repo.split('/')[1]
      try {
        await ghApi(cfg.token, '/user/repos', {
          method: 'POST',
          body: JSON.stringify({
            name,
            private: true,
            description: 'ApkForge APK build workspace (created by the ApkForge builder website)',
            has_issues: false,
            has_projects: false,
            has_wiki: false,
            auto_init: false,
          }),
        })
        createdRepo = true
      } catch (e2) {
        if (e2 instanceof GithubApiError) {
          throw new GithubConfigError(
            `Could not create repo "${name}" (HTTP ${e2.status}). The token needs repo creation rights (classic PAT: repo scope; fine-grained: Administration: Read and write). ${e2.message}`
          )
        }
        throw e2
      }
    } else {
      throw e
    }
  }

  // 3) workflow file (force check + push/update)
  repoCache.delete(cfg.repo)
  const info = await ensureBuildRepo(cfg, { force: true })

  return {
    login: me.login,
    createdRepo,
    repoUrl: info.htmlUrl,
    defaultBranch: info.defaultBranch,
    workflowUpdated: info.workflowOk,
  }
}
