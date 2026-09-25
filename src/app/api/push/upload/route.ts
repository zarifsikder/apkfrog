import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

const IMAGES_DIR = path.join(process.cwd(), 'db', 'push-images')
const MAX_BYTES = 3 * 1024 * 1024
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Upload a notification image (data URL) → stored on disk, served via /api/push/image/[name]
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  try {
    const body = await req.json().catch(() => ({}))
    const dataUrl = String(body.dataUrl || '')
    const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/)
    if (!m) {
      return NextResponse.json({ error: 'Only PNG, JPEG, WebP or GIF images are allowed' }, { status: 400 })
    }
    const mime = m[1]
    const buf = Buffer.from(m[2], 'base64')
    if (buf.length === 0 || buf.length > MAX_BYTES) {
      return NextResponse.json({ error: 'Image is too large (max 3 MB)' }, { status: 400 })
    }
    // verify it is a real image (sharp decodes — rejects embedded scripts / fake extensions)
    try {
      const sharp = (await import('sharp')).default
      const meta = await sharp(buf).metadata()
      if (!meta.width || !meta.height) throw new Error('bad image')
    } catch {
      return NextResponse.json({ error: 'Corrupted or unsupported image' }, { status: 400 })
    }
    await mkdir(IMAGES_DIR, { recursive: true })
    const name = `push_${randomUUID().replace(/-/g, '')}.${EXT[mime]}`
    await writeFile(path.join(IMAGES_DIR, name), buf)
    return NextResponse.json({ url: `/api/push/image/${name}` }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
