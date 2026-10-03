import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * GET /api/notifications/[id]
 * Open a single notification (auto-marks it as read) and return the
 * notification together with its full comment thread (user comments +
 * admin replies, oldest first).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await ctx.params

  const notif = await db.notification.findUnique({
    where: { id },
    include: {
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  })

  if (!notif || notif.userId !== user.id) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  }

  // Mark read on first open (idempotent + emits realtime so other clients update)
  if (!notif.read) {
    await db.notification.update({ where: { id }, data: { read: true } })
    publish('notifications', { action: 'read', id }, user.id)
  }

  return NextResponse.json({
    notification: {
      id: notif.id,
      title: notif.title,
      body: notif.body,
      read: true,
      createdAt: notif.createdAt,
      comments: notif.comments.map((c) => ({
        id: c.id,
        notificationId: c.notificationId,
        userId: c.userId,
        userName: c.user?.name || 'User',
        body: c.body,
        isAdminReply: c.isAdminReply,
        createdAt: c.createdAt,
      })),
    },
  })
}
