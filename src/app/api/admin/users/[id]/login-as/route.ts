import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminUser, createSession, setSessionCookie } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * POST /api/admin/users/[id]/login-as
 *
 * Admin "Login as this user" — creates a fresh session for the target user
 * and returns it via the standard wv_session cookie. The admin's own session
 * is NOT touched (they can log out and back in to return to admin).
 *
 * Guards:
 *   • caller must be an admin (role === 'ADMIN')
 *   • target cannot be another admin (cannot impersonate admins)
 *   • target cannot be banned
 *
 * Returns the target user's public profile so the client can immediately
 * swap the in-memory user state and route to the home view.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getUser(req)
  if (!admin) return unauthorized()
  if (!isAdminUser(admin)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { id } = await ctx.params
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'ADMIN') {
    return NextResponse.json({ error: 'Cannot impersonate another admin — demote them first' }, { status: 400 })
  }
  if (target.banned) {
    return NextResponse.json({ error: 'Cannot login as a suspended user — restore them first' }, { status: 400 })
  }

  // Create a new session for the target user
  const { token, expiresAt } = await createSession(target.id)

  // Audit trail: notify BOTH the admin (so they remember they impersonated)
  // and the target user (so they can see admin logged in as them).
  await db.notification.create({
    data: {
      userId: target.id,
      title: 'Admin access notice 🔐',
      body: `An administrator (${admin.name}) logged into your account from the Admin Panel at ${new Date().toLocaleString()}. If this wasn't authorized, please contact support.`,
    },
  }).catch(() => {})
  publish('notifications', { action: 'new' }, target.id)

  const res = NextResponse.json({
    user: {
      id: target.id,
      name: target.name,
      email: target.email,
      wallet: target.wallet,
      plan: target.plan,
      referralCode: target.referralCode,
      publicId: target.publicId || 'AF-000000',
      role: target.role === 'ADMIN' ? 'ADMIN' : 'USER',
      createdAt: target.createdAt,
    },
    impersonatedBy: { id: admin.id, name: admin.name },
  })
  setSessionCookie(res, token, expiresAt)
  return res
}
