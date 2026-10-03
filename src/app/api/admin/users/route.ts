import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminUser } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * Admin Panel → Users — list every account with its activity counts.
 * ?q= filters by name/email/publicId/referralCode (case-insensitive contains).
 *
 * Admin status comes from the database `role` column (USER | ADMIN) — it is no
 * longer derived from a hardcoded email list.
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminUser(user)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const q = (req.nextUrl.searchParams.get('q') || '').trim()
  const where = q
    ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } },
          { publicId: { contains: q } },
          { referralCode: { contains: q } },
        ],
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
      role: true,
      banned: true,
      referralCode: true,
      publicId: true,
      createdAt: true,
      _count: { select: { projects: true, builds: true, payments: true } },
    },
  })

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      // back-compat: `admin` boolean for the older client shape
      admin: u.role === 'ADMIN',
    })),
  })
}
