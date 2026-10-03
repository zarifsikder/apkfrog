import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminUser } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * POST /api/admin/notifications/send
 * Admin sends a custom notification:
 *   { title, body, recipient: 'all' | 'specific', userIds?: string[] }
 *
 * - recipient='all'           → one Notification row per user
 * - recipient='specific'      → one Notification row per id in userIds[]
 *
 * Returns the count of recipients and a snapshot of the created rows.
 * Emits realtime so each recipient's bell icon updates instantly.
 */
export async function POST(req: NextRequest) {
  const admin = await getUser(req)
  if (!admin) return unauthorized()
  if (!isAdminUser(admin)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const { title, body, recipient, userIds } = await req.json().catch(() => ({} as any))
  const t = typeof title === 'string' ? title.trim() : ''
  const b = typeof body === 'string' ? body.trim() : ''
  if (!t) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  if (!b) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

  let targetUserIds: string[] = []
  if (recipient === 'all') {
    const all = await db.user.findMany({ where: { banned: false }, select: { id: true } })
    targetUserIds = all.map((u) => u.id)
  } else if (recipient === 'specific') {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one user' }, { status: 400 })
    }
    // de-dup + verify existence
    const found = await db.user.findMany({
      where: { id: { in: Array.from(new Set(userIds as string[])) } },
      select: { id: true },
    })
    targetUserIds = found.map((u) => u.id)
  } else {
    return NextResponse.json({ error: 'Invalid recipient type' }, { status: 400 })
  }

  if (targetUserIds.length === 0) {
    return NextResponse.json({ error: 'No recipients matched' }, { status: 400 })
  }

  // Bulk insert — one notification row per user
  const created = await db.notification.createMany({
    data: targetUserIds.map((uid) => ({ userId: uid, title: t, body: b })),
  })

  // Realtime: every recipient's bell refreshes
  for (const uid of targetUserIds) {
    publish('notifications', { action: 'new' }, uid)
  }
  // Admin inbox: a new broadcast went out
  publish('adminNotifications', { action: 'sent' })

  return NextResponse.json({
    ok: true,
    recipients: created.count,
    title: t,
    body: b,
  }, { status: 201 })
}
