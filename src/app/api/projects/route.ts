import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'
import { defaultFilesFor } from '@/lib/projectTemplates'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const projects = await db.project.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' },
    include: { files: { select: { id: true } } },
  })
  return NextResponse.json({
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      fileCount: p.files.length,
    })),
  })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  try {
    const { name, type, fromTemplate } = await req.json()
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Project name must be at least 2 characters' }, { status: 400 })
    }
    const validTypes = ['blank', 'webview', 'html', 'kotlin']
    const projType = validTypes.includes(type) ? type : 'blank'
    const cleanName = name.trim().slice(0, 40)

    const project = await db.project.create({
      data: { name: cleanName, type: projType, userId: user.id },
    })

    let files = defaultFilesFor(projType, cleanName)
    if (fromTemplate?.files?.length) {
      files = fromTemplate.files
    }
    await db.projectFile.createMany({
      data: files.map((f) => ({ path: f.path, content: f.content, language: f.language, projectId: project.id })),
    })

    const full = await db.project.findUnique({ where: { id: project.id }, include: { files: true } })
    publish('projects', { action: 'create', id: project.id }, user.id)
    return NextResponse.json({ project: full }, { status: 201 })
  } catch (e) {
    console.error('create project error', e)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
