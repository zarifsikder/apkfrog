import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { startGithubBuild } from '@/lib/github-build'
import { getGithubConfig, resolveSiteOrigin } from '@/lib/github-config'
import { publish } from '@/lib/events'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { storagePath } from '@/lib/storage-path'
import { writeStorage, isRemoteStorage } from '@/lib/remote-storage'

const ZIP_DIR = storagePath('uploads')

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const builds = await db.build.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return NextResponse.json({ builds })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  try {
    const body = await req.json()
    const appName = String(body.appName || '').trim()
    const packageName = String(body.packageName || '').trim()
    if (!appName || appName.length < 2) {
      return NextResponse.json({ error: 'App name is required' }, { status: 400 })
    }
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) {
      return NextResponse.json({ error: 'Package name must look like com.myapp.main' }, { status: 400 })
    }

    // Parse build config and enforce Pro-only features server-side FIRST —
    // we want to reject Free users trying to use encryption BEFORE checking
    // the GitHub engine (so they get a clear 403 instead of a 503 about the
    // engine being unconfigured).
    const parsedConfig: Record<string, unknown> = body.config && typeof body.config === 'object' ? { ...body.config } : {}
    const sourceType = body.sourceType === 'kotlin' ? 'kotlin' : 'html'
    if (parsedConfig.enableAssetEncryption) {
      if (user.plan !== 'Pro') {
        return NextResponse.json(
          { error: 'AES-256 asset encryption is a Pro-only feature. Upgrade your plan to use it.' },
          { status: 403 },
        )
      }
      // Encryption only applies to HTML/WebView builds — silently strip for Kotlin
      if (sourceType !== 'html') {
        parsedConfig.enableAssetEncryption = false
      }
    }

    // single build engine: GitHub Actions (configured in Admin Panel → Engine)
    const gh = await getGithubConfig()
    if (!gh) {
      return NextResponse.json(
        { error: 'Build engine is not configured yet. Ask the admin to connect GitHub Actions in Admin Panel → Engine.' },
        { status: 503 }
      )
    }

    const sourceMode = ['url', 'project', 'zip'].includes(body.sourceMode) ? body.sourceMode : 'project'

    if (sourceType === 'html' && sourceMode === 'url' && !/^https?:\/\/.+/.test(String(body.websiteUrl || ''))) {
      return NextResponse.json({ error: 'Please enter a valid website URL (https://...)' }, { status: 400 })
    }
    if (sourceType === 'html' && sourceMode === 'project') {
      if (!body.projectId) return NextResponse.json({ error: 'Please select a project' }, { status: 400 })
      const proj = await db.project.findFirst({ where: { id: body.projectId, userId: user.id } })
      if (!proj) return NextResponse.json({ error: 'Selected project not found' }, { status: 404 })
    }
    if (sourceType === 'kotlin') {
      if (!body.projectId) return NextResponse.json({ error: 'Please select a Kotlin/Java project' }, { status: 400 })
      const proj = await db.project.findFirst({ where: { id: body.projectId, userId: user.id } })
      if (!proj) return NextResponse.json({ error: 'Selected project not found' }, { status: 404 })
      if (!body.zipBase64) return NextResponse.json({ error: 'Could not package Kotlin project files — please try again' }, { status: 400 })
    }

    let zipPath: string | null = null
    if (body.zipBase64) {
      const raw = Buffer.from(String(body.zipBase64).split(',').pop() || '', 'base64')
      if (raw.length > 15 * 1024 * 1024) {
        return NextResponse.json({ error: 'ZIP file too large (max 15 MB)' }, { status: 400 })
      }
      // Persist the uploaded Kotlin project zip — to cPanel on Vercel, to disk in dev
      const zipFileName = `build-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`
      const relPath = `uploads/${zipFileName}`
      if (isRemoteStorage()) {
        await writeStorage(relPath, raw)
        zipPath = relPath
      } else {
        await mkdir(ZIP_DIR, { recursive: true })
        zipPath = path.join(ZIP_DIR, zipFileName)
        await writeFile(zipPath, raw)
      }
    }

    const build = await db.build.create({
      data: {
        appName: appName.slice(0, 40),
        packageName,
        versionName: String(body.versionName || '1.0').slice(0, 20),
        versionCode: Math.max(1, Math.min(999999, parseInt(body.versionCode) || 1)),
        sourceType,
        sourceMode,
        websiteUrl: body.websiteUrl ? String(body.websiteUrl).slice(0, 500) : null,
        zipPath,
        config: JSON.stringify(parsedConfig),
        logs: '',
        userId: user.id,
        projectId: body.projectId || null,
        status: 'queued',
        provider: 'github',
      },
    })

    const origin = await resolveSiteOrigin(req)
    if (!origin) {
      await db.build.update({
        where: { id: build.id },
        data: {
          status: 'failed',
          error:
            'GitHub Actions is configured, but the Public Site URL is missing. Set it in Admin Panel → Engine (needed so runners can download your source).',
          completedAt: new Date(),
        },
      })
      const failed = await db.build.findUnique({ where: { id: build.id } })
      return NextResponse.json({ build: failed, warning: 'Missing public site URL' }, { status: 201 })
    }
    startGithubBuild(build.id, origin).catch(() => {})
    publish('builds', { action: 'create', id: build.id, status: build.status }, user.id)
    return NextResponse.json({ build }, { status: 201 })
  } catch (e) {
    console.error('create build error', e)
    return NextResponse.json({ error: 'Failed to start build' }, { status: 500 })
  }
}
