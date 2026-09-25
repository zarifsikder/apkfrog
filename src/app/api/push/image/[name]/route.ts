import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const IMAGES_DIR = path.join(process.cwd(), 'db', 'push-images')
const NAME_RE = /^[A-Za-z0-9_-]+\.(png|jpg|jpeg|webp|gif)$/
const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

// Serve uploaded push-notification images to the built APKs (public)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  if (!NAME_RE.test(name)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const buf = await readFile(path.join(IMAGES_DIR, name))
    const ext = name.split('.').pop()!.toLowerCase()
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
