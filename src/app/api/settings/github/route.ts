import { NextRequest, NextResponse } from 'next/server'
import { getUser, unauthorized } from '@/lib/auth'
import { getGithubConfigMasked, setSetting, deleteSetting, getGithubConfig } from '@/lib/github-config'
import { publish } from '@/lib/events'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const cfg = await getGithubConfigMasked()
  // live token validation (cheap, only when configured)
  let tokenValid: boolean | null = null
  let login: string | null = null
  const full = await getGithubConfig()
  if (full) {
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${full.token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ApkForge-Builder',
        },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      })
      tokenValid = res.ok
      if (res.ok) login = (await res.json()).login || null
    } catch {
      tokenValid = null
    }
  }
  return NextResponse.json({ ...cfg, tokenValid, login })
}

export async function PUT(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  try {
    const body = await req.json()
    const token = String(body.token || '').trim()
    const repo = String(body.repo || '').trim()
    const siteOrigin = String(body.siteOrigin || '').trim()

    if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      return NextResponse.json({ error: 'Repo must look like owner/name' }, { status: 400 })
    }
    if (siteOrigin && !/^https?:\/\/.+/.test(siteOrigin)) {
      return NextResponse.json({ error: 'Site URL must start with http(s)://' }, { status: 400 })
    }
    if (token) {
      // validate before saving
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ApkForge-Builder' },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      })
      if (!res.ok) {
        return NextResponse.json(
          { error: res.status === 401 ? 'Invalid token (401) — check scopes and expiry' : `GitHub token check failed (HTTP ${res.status})` },
          { status: 400 }
        )
      }
      await setSetting('github_token', token)
    }
    if (repo) await setSetting('github_repo', repo)
    if (body.siteOrigin !== undefined) {
      if (siteOrigin) await setSetting('site_origin', siteOrigin.replace(/\/+$/, ''))
      else await deleteSetting('site_origin')
    }
    if (body.clearToken) await deleteSetting('github_token')
    publish('engine', { action: 'save' }, user.id)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  await deleteSetting('github_token')
  await deleteSetting('github_repo')
  await deleteSetting('site_origin')
  publish('engine', { action: 'clear' }, user.id)
  return NextResponse.json({ ok: true })
}
