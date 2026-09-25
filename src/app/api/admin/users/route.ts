import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminEmail } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * Admin Panel → Users — list every account with its activity counts.
 * ?q= filters by name/email (case-insensitive contains).
 * Admin accounts are listed too but cannot be edited/deleted (guarded in the
 * [id] routes).
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const where = q
    ? {
        OR: [{ name: { contains: q } }, { email: { contains: q } }],
      }
    : {}

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: {
      id: true,
      name: true,
      email: true,
      wallet: true,
      plan: true,
      banned: true,
      referralCode: true,
      createdAt: true,
      _count: { select: { projects: true, builds: true, payments: true } },
    },
  })

  return NextResponse.json({ users: users.map((u) => ({ ...u, admin: isAdminEmail(u.email) })) })
}
