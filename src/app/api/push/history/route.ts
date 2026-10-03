import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

// History of push notifications sent by this user
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const items = await db.pushNotification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { _count: { select: { deliveries: true } } },
  })
  return NextResponse.json({
    notifications: items.map((n) => ({
      id: n.id,
      packageName: n.packageName,
      title: n.title,
      description: n.description,
      imageUrl: n.imageUrl,
      html: n.html,
      delivered: n._count.deliveries,
      createdAt: n.createdAt.toISOString(),
    })),
  })
}
