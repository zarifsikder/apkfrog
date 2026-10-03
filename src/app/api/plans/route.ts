import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * Public — list active subscription plans for the user Subscription page.
 * Sorted by sortOrder asc, then createdAt asc.
 */
export async function GET() {
  const plans = await db.plan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      priceYearly: true,
      features: true,
      accent: true,
      isPopular: true,
      sortOrder: true,
    },
  })
  return NextResponse.json({ plans })
}
