import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminUser } from '@/lib/auth'

/**
 * GET /api/admin/notifications
 * Admin reads every notification ever sent, with the recipient user and the
 * full comment thread on each. Supports pagination + search by title/email.
 *
 * ?q=       free-text filter (title or recipient email)
 * ?only=mine  only notifications sent by this admin (best-effort — every
 *            notification sent through /admin/notifications/send is treated as
 *            "admin-sent"; system notifications from builds/payments are also
 *            included so the admin can see the full activity feed)
 * ?cursor=  cursor (createdAt,id) for the previous page
 */
export async function GET(req: NextRequest) {
  const admin = await getUser(req)
  if (!admin) return unauthorized()
  if (!isAdminUser(admin)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get('limit') || '20', 10) || 20)
  const cursor = req.nextUrl.searchParams.get('cursor') // format: "<createdAtIso>|<id>"

  const where: any = {}
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { body: { contains: q } },
      { user: { email: { contains: q } } },
      { user: { name: { contains: q } } },
    ]
  }

  const items = await db.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    include: {
      user: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  })

  const hasMore = items.length > limit
  const slice = hasMore ? items.slice(0, limit) : items
  const nextCursor = hasMore ? slice[slice.length - 1].id : null

  return NextResponse.json({
    notifications: slice.map((n) => ({
      id: n.id,
      userId: n.userId,
      userName: n.user?.name || 'User',
      userEmail: n.user?.email || '',
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt,
      comments: n.comments.map((c) => ({
        id: c.id,
        notificationId: c.notificationId,
        userId: c.userId,
        userName: c.user?.name || (c.isAdminReply ? 'Admin' : 'User'),
        body: c.body,
        isAdminReply: c.isAdminReply,
        createdAt: c.createdAt,
      })),
    })),
    nextCursor,
  })
}
