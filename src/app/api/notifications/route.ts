import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const notifications = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 })
  const unread = notifications.filter((n) => !n.read).length
  return NextResponse.json({ notifications, unread })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } })
  publish('notifications', { action: 'readAll' }, user.id)
  return NextResponse.json({ ok: true })
}
