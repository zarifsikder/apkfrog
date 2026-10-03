import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'kt':
    case 'kts':
      return 'kotlin'
    case 'xml':
      return 'xml'
    case 'html':
      return 'html'
    case 'css':
      return 'css'
    case 'js':
      return 'javascript'
    case 'json':
      return 'json'
    case 'java':
      return 'java'
    default:
      return 'plaintext'
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const project = await db.project.findFirst({ where: { id, userId: user.id } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const files = await db.projectFile.findMany({
    where: { projectId: id },
    select: { id: true, path: true, content: true, language: true, updatedAt: true },
    orderBy: { path: 'asc' },
  })
  return NextResponse.json({ files })
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const project = await db.project.findFirst({ where: { id, userId: user.id } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const { path, content } = await req.json()
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'File path is required' }, { status: 400 })
  }
  const cleanPath = path.replace(/^\/+/, '').slice(0, 200)
  const exists = await db.projectFile.findFirst({ where: { projectId: id, path: cleanPath } })
  if (exists) return NextResponse.json({ error: 'A file with this name already exists' }, { status: 409 })
  const file = await db.projectFile.create({
    data: { path: cleanPath, content: typeof content === 'string' ? content : '', language: detectLanguage(cleanPath), projectId: id },
  })
  publish('files', { action: 'create', projectId: id, fileId: file.id }, user.id)
  return NextResponse.json({ file }, { status: 201 })
}
