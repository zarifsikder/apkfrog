import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { storagePath } from '@/lib/storage-path'
import { streamStorage, isRemoteStorage } from '@/lib/remote-storage'

const IMAGES_DIR = storagePath('push-images')
const NAME_RE = /^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

/**
 * Serve uploaded push-notification images to the built APKs (public).
 *
 * On Vercel + cPanel:  streams from cPanel storage
 * In dev:              reads from local disk
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params
  if (!NAME_RE.test(name)) {
    return NextResponse.json({ error: 'Invalid image name' }, { status: 400 })
  }
  const ext = path.extname(name).slice(1).toLowerCase()
  const mime = MIME[ext] || 'application/octet-stream'

  try {
    if (isRemoteStorage()) {
      const relPath = `push-images/${name}`
      const streamed = await streamStorage(relPath)
      if (!streamed) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 })
      }
      return new NextResponse(streamed.body, {
        headers: {
          'Content-Type': mime,
          'Content-Length': String(streamed.size),
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }
    const buf = await readFile(path.join(IMAGES_DIR, name))
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': mime,
        'Content-Length': String(buf.length),
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }
}
