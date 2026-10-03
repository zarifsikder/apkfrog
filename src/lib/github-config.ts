import { db } from '@/lib/db'
import type { NextRequest } from 'next/server'

/**
 * GitHub build settings — stored in the Setting table (configurable from the UI),
 * with environment variables as fallback:
 *   GITHUB_TOKEN   — Personal Access Token (classic: repo + workflow scopes)
 *   GITHUB_REPO    — owner/name of the build repo
 *   SELF_ORIGIN / NEXT_PUBLIC_APP_URL — public site URL (so GitHub runners can fetch source zips)
 */

const K_TOKEN = 'github_token'
const K_REPO = 'github_repo'
const K_ORIGIN = 'site_origin'

export interface GithubConfig {
  token: string
  repo: string // owner/name
  siteOrigin: string | null
  source: 'db' | 'env' | 'mixed'
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } }).catch(() => null)
  return row?.value ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

export async function deleteSetting(key: string): Promise<void> {
  await db.setting.delete({ where: { key } }).catch(() => {})
}

export async function getGithubConfig(): Promise<GithubConfig | null> {
  const [dbToken, dbRepo] = await Promise.all([getSetting(K_TOKEN), getSetting(K_REPO)])
  const token = dbToken || process.env.GITHUB_TOKEN || ''
  const repo = dbRepo || process.env.GITHUB_REPO || ''
  if (!token || !repo) return null
  const siteOrigin = await getSiteOriginSetting()
  let source: GithubConfig['source'] = 'env'
  if (dbToken && dbRepo) source = 'db'
  else if (dbToken || dbRepo) source = 'mixed'
  return { token, repo, siteOrigin, source }
}

export async function getSiteOriginSetting(): Promise<string | null> {
  const v = (await getSetting(K_ORIGIN)) || process.env.SELF_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || ''
  return v && /^https?:\/\//.test(v) ? v.replace(/\/+$/, '') : null
}

/**
 * Best-effort public origin: DB setting > request Origin header > env.
 */
export async function resolveSiteOrigin(req?: NextRequest): Promise<string | null> {
  const fromSetting = await getSiteOriginSetting()
  if (fromSetting) return fromSetting
  const reqOrigin = req?.headers.get('origin') || null
  if (reqOrigin && /^https?:\/\//.test(reqOrigin) && !reqOrigin.includes('localhost') && !reqOrigin.includes('127.0.0.1')) {
    return reqOrigin.replace(/\/+$/, '')
  }
  const envOrigin = process.env.SELF_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || ''
  if (envOrigin && /^https?:\/\//.test(envOrigin)) return envOrigin.replace(/\/+$/, '')
  return null
}

export function maskToken(token: string): string {
  if (token.length <= 8) return '••••'
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`
}

export async function getGithubConfigMasked() {
  const cfg = await getGithubConfig()
  if (!cfg) {
    return { configured: false, repo: null, siteOrigin: null, tokenMasked: null, source: null }
  }
  return {
    configured: true,
    repo: cfg.repo,
    siteOrigin: cfg.siteOrigin,
    tokenMasked: maskToken(cfg.token),
    source: cfg.source,
  }
}
