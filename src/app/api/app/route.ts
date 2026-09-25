import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminEmail } from '@/lib/auth'
import { publish } from '@/lib/events'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

const RELEASES_DIR = path.join(process.cwd(), 'db', 'app-releases')
const MAX_APK_BYTES = 200 * 1024 * 1024 // 200 MB

function serialize(r: {
  id: string
  versionName: string
  versionCode: number
  notes: string
  size: number
  downloads: number
  isActive: boolean
  createdAt: Date
}) {
  return {
    id: r.id,
    versionName: r.versionName,
    versionCode: r.versionCode,
    notes: r.notes,
    size: r.size,
    downloads: r.downloads,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }
}

// Public: latest published app release info (no login needed — the auth page shows a download link too)
export async function GET() {
  const release = await db.appRelease.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ release: release ? serialize(release) : null })
}

// Admin: publish a new APK release (multipart: apk file + versionName + versionCode + notes)
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  try {
    const form = await req.formData()
    const file = form.get('apk')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Please choose an .apk file' }, { status: 400 })
    }
    if (!/\.apk$/i.test(file.name)) {
      return NextResponse.json({ error: 'Only .apk files are allowed' }, { status: 400 })
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'APK file is empty' }, { status: 400 })
    }
    if (file.size > MAX_APK_BYTES) {
      return NextResponse.json({ error: 'APK file is too large (max 200 MB)' }, { status: 400 })
    }
    const versionName = (String(form.get('versionName') || '').trim() || '1.0').slice(0, 20)
    if (!/^[\w.()-]+$/.test(versionName)) {
      return NextResponse.json({ error: 'Version name can only contain letters, numbers, dot, dash' }, { status: 400 })
    }
    const versionCode = Math.max(1, parseInt(String(form.get('versionCode') || '1'), 10) || 1)
    const notes = String(form.get('notes') || '').trim().slice(0, 2000)

    await mkdir(RELEASES_DIR, { recursive: true })
    const fileName = `apkforge-v${versionName}-${Date.now()}.apk`
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(path.join(RELEASES_DIR, fileName), buf)

    // only one active release at a time
    await db.appRelease.updateMany({ where: { isActive: true }, data: { isActive: false } })
    const release = await db.appRelease.create({
      data: { versionName, versionCode, notes, fileName, size: buf.length, isActive: true },
    })
    publish('app', { action: 'publish', versionName, versionCode }, user.id)
    return NextResponse.json({ ok: true, release: serialize(release) })
  } catch {
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
