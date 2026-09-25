import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminEmail } from '@/lib/auth'
import { publish } from '@/lib/events'
import { unlink } from 'fs/promises'
import path from 'path'

const RELEASES_DIR = path.join(process.cwd(), 'db', 'app-releases')

type Params = { params: Promise<{ id: string }> }

// Admin: delete a release (record + file)
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  const { id } = await params
  const release = await db.appRelease.findUnique({ where: { id } })
  if (!release) return NextResponse.json({ error: 'Release not found' }, { status: 404 })
  try {
    await unlink(path.join(RELEASES_DIR, release.fileName))
  } catch {}
  await db.appRelease.delete({ where: { id } })
  // if the deleted one was active, promote the most recent remaining release
  const next = await db.appRelease.findFirst({ orderBy: { createdAt: 'desc' } })
  if (next) {
    await db.appRelease.update({ where: { id: next.id }, data: { isActive: true } })
  }
  publish('app', { action: 'unpublish', id }, user.id)
  return NextResponse.json({ ok: true })
}
