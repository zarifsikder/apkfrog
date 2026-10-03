import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * POST /api/notifications/[id]/comments
 * Authenticated user posts a comment on one of their own notifications.
 * Triggers a realtime event so the admin inbox updates immediately.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await ctx.params

  const { body: text } = await req.json().catch(() => ({ body: '' }))
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
  if (trimmed.length > 2000) return NextResponse.json({ error: 'Comment is too long (max 2000 chars)' }, { status: 400 })

  // Ensure the notification belongs to the user (security check)
  const notif = await db.notification.findUnique({ where: { id }, select: { userId: true } })
  if (!notif || notif.userId !== user.id) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  }

  const comment = await db.notificationComment.create({
    data: {
      notificationId: id,
      userId: user.id,
      body: trimmed,
      isAdminReply: false,
    },
    include: { user: { select: { name: true } } },
  })

  // Realtime: user gets new reply instantly; admins get pinged to refresh inbox
  publish('notifications', { action: 'comment', notificationId: id }, user.id)
  publish('adminNotifications', { action: 'newComment', notificationId: id })

  return NextResponse.json({
    comment: {
      id: comment.id,
      notificationId: comment.notificationId,
      userId: comment.userId,
      userName: comment.user?.name || 'User',
      body: comment.body,
      isAdminReply: comment.isAdminReply,
      createdAt: comment.createdAt,
    },
  }, { status: 201 })
}
