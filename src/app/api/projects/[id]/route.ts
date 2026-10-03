import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    include: { files: { orderBy: { path: 'asc' } } },
  })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ project })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const project = await db.project.findFirst({ where: { id, userId: user.id } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  await db.project.delete({ where: { id } })
  publish('projects', { action: 'delete', id }, user.id)
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const project = await db.project.findFirst({ where: { id, userId: user.id } })
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  const { name } = await req.json()
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Invalid project name' }, { status: 400 })
  }
  const updated = await db.project.update({ where: { id }, data: { name: name.trim().slice(0, 40) } })
  publish('projects', { action: 'rename', id }, user.id)
  return NextResponse.json({ project: updated })
}
