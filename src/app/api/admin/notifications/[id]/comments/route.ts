import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminUser } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * POST /api/admin/notifications/[id]/comments
 * Admin posts a reply to ANY user's notification (the admin is replying
 * inside the user's notification thread). The reply is flagged
 * `isAdminReply=true` so the UI can style it as an admin message.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getUser(req)
  if (!admin) return unauthorized()
  if (!isAdminUser(admin)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }
  const { id } = await ctx.params

  const { body: text } = await req.json().catch(() => ({ body: '' }))
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return NextResponse.json({ error: 'Reply cannot be empty' }, { status: 400 })
  if (trimmed.length > 2000) return NextResponse.json({ error: 'Reply is too long (max 2000 chars)' }, { status: 400 })

  // Notification must exist; admin can reply to any user's notification
  const notif = await db.notification.findUnique({ where: { id }, select: { userId: true } })
  if (!notif) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })

  const comment = await db.notificationComment.create({
    data: {
      notificationId: id,
      userId: admin.id,
      body: trimmed,
      isAdminReply: true,
    },
    include: { user: { select: { name: true } } },
  })

  // Realtime: user sees the admin reply instantly; admin inbox refreshes
  publish('notifications', { action: 'reply', notificationId: id, byUserId: notif.userId }, notif.userId)
  publish('adminNotifications', { action: 'newReply', notificationId: id })

  return NextResponse.json({
    comment: {
      id: comment.id,
      notificationId: comment.notificationId,
      userId: comment.userId,
      userName: comment.user?.name || 'Admin',
      body: comment.body,
      isAdminReply: comment.isAdminReply,
      createdAt: comment.createdAt,
    },
  }, { status: 201 })
}
