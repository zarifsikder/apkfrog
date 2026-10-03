import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminUser, hashPassword } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * Admin Panel → Users — edit one account.
 * Body (all optional):
 *   walletSet    → set the wallet balance to an exact amount
 *   walletAdjust → add (positive) or subtract (negative) from the balance
 *   plan         → "Free" | "Pro"
 *   banned       → true suspends (kills all sessions), false restores access
 *   name         → rename the account
 *   password     → set a new password
 *   role         → "USER" | "ADMIN"  (promote/demote — see guards below)
 *
 * Admin status comes from the `role` column. To prevent the platform from
 * losing its last admin, we block any role change that would leave zero
 * admins in the database.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getUser(req)
  if (!admin) return unauthorized()
  if (!isAdminUser(admin)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { id } = await params
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}

  if (body.walletSet !== undefined) {
    const v = parseInt(String(body.walletSet), 10)
    if (Number.isNaN(v) || v < 0 || v > 10_000_000) return NextResponse.json({ error: 'Invalid wallet amount' }, { status: 400 })
    data.wallet = v
  }
  if (body.walletAdjust !== undefined) {
    const v = parseInt(String(body.walletAdjust), 10)
    if (Number.isNaN(v) || Math.abs(v) > 10_000_000) return NextResponse.json({ error: 'Invalid wallet amount' }, { status: 400 })
    const next = target.wallet + v
    if (next < 0) return NextResponse.json({ error: `Balance cannot go below 0 (current ৳${target.wallet})` }, { status: 400 })
    data.wallet = next
  }
  if (body.plan !== undefined) {
    const p = String(body.plan)
    if (!['Free', 'Pro'].includes(p)) return NextResponse.json({ error: 'Plan must be Free or Pro' }, { status: 400 })
    data.plan = p
  }
  if (body.name !== undefined) {
    const n = String(body.name).trim()
    if (!n || n.length > 60) return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    data.name = n
  }
  if (body.password !== undefined) {
    const pw = String(body.password)
    if (pw.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    data.password = hashPassword(pw)
  }
  if (body.banned !== undefined) {
    data.banned = !!body.banned
  }

  // Role change: promote (USER → ADMIN) or demote (ADMIN → USER)
  if (body.role !== undefined) {
    const r = String(body.role).toUpperCase()
    if (r !== 'USER' && r !== 'ADMIN') {
      return NextResponse.json({ error: 'Role must be USER or ADMIN' }, { status: 400 })
    }
    // No-op
    if (r === target.role) {
      /* nothing to do */
    } else if (r === 'ADMIN') {
      // Promoting a regular user to admin
      data.role = 'ADMIN'
    } else {
      // Demoting an admin → block if it would leave zero admins
      const adminCount = await db.user.count({ where: { role: 'ADMIN' } })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last remaining admin — promote another user first.' },
          { status: 400 },
        )
      }
      // An admin cannot demote themselves (lockout protection)
      if (target.id === admin.id) {
        return NextResponse.json(
          { error: 'You cannot demote your own account. Ask another admin to do it.' },
          { status: 400 },
        )
      }
      data.role = 'USER'
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const updated = await db.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, wallet: true, plan: true, role: true, banned: true },
  })

  // Suspension is immediate: every active session of a banned user is destroyed
  if (data.banned === true) {
    await db.session.deleteMany({ where: { userId: id } })
    await db.notification.create({
      data: { userId: id, title: 'Account suspended', body: 'Your account has been suspended by an administrator. Contact support if you think this is a mistake.' },
    }).catch(() => {})
  }
  if (data.banned === false) {
    await db.notification.create({
      data: { userId: id, title: 'Account restored ✅', body: 'Your account has been restored. Welcome back!' },
    }).catch(() => {})
  }

  // Role-change notifications
  if (data.role === 'ADMIN') {
    await db.notification.create({
      data: { userId: id, title: 'You are now an Admin 🛡️', body: 'An administrator has promoted your account. Open More → Admin Panel to access platform controls.' },
    }).catch(() => {})
  } else if (data.role === 'USER') {
    await db.session.deleteMany({ where: { userId: id } }).catch(() => {})
    await db.notification.create({
      data: { userId: id, title: 'Admin access removed', body: 'Your admin privileges have been revoked. You can continue using the platform as a regular user.' },
    }).catch(() => {})
  }

  publish('users', { action: 'update', id }, admin.id)
  return NextResponse.json({ user: updated })
}

/**
 * Admin Panel → Users — permanently delete an account and every project,
 * build, payment and notification attached to it (schema-level cascade).
 *
 * Admins cannot delete other admins, and an admin cannot delete themselves.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getUser(req)
  if (!admin) return unauthorized()
  if (!isAdminUser(admin)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { id } = await params
  const target = await db.user.findUnique({ where: { id } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.role === 'ADMIN') return NextResponse.json({ error: 'Admin accounts cannot be deleted (demote to USER first)' }, { status: 400 })
  if (target.id === admin.id) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })

  await db.session.deleteMany({ where: { userId: id } })
  await db.user.delete({ where: { id } })

  publish('users', { action: 'delete', id }, admin.id)
  return NextResponse.json({ ok: true })
}
