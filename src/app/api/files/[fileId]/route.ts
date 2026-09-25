import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ fileId: string }> }

async function ownedFile(req: NextRequest, fileId: string) {
  const user = await getUser(req)
  if (!user) return { error: unauthorized() as NextResponse }
  const file = await db.projectFile.findUnique({ where: { id: fileId }, include: { project: true } })
  if (!file || file.project.userId !== user.id) {
    return { error: NextResponse.json({ error: 'File not found' }, { status: 404 }) }
  }
  return { file, userId: user.id }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { fileId } = await params
  const { file, userId, error } = await ownedFile(req, fileId)
  if (error || !file) return error!
  const { content } = await req.json()
  const updated = await db.projectFile.update({
    where: { id: fileId },
    data: { content: typeof content === 'string' ? content : file.content },
  })
  await db.project.update({ where: { id: file.projectId }, data: { updatedAt: new Date() } })
  publish('files', { action: 'save', projectId: file.projectId, fileId }, userId)
  return NextResponse.json({ file: updated })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { fileId } = await params
  const { file, userId, error } = await ownedFile(req, fileId)
  if (error || !file) return error!
  await db.projectFile.delete({ where: { id: fileId } })
  publish('files', { action: 'delete', projectId: file.projectId, fileId }, userId)
  return NextResponse.json({ ok: true })
}
