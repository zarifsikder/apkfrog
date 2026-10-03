import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

/**
 * GET /api/payments
 * List the current user's payment history (auto-gateway payments only).
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const payments = await db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ payments })
}

/**
 * POST /api/payments  — kept for back-compat, but the manual bKash/Nagad/Rocket
 * flow has been removed. New add-money requests must go through
 * /api/payments/auto/create which creates a real gateway checkout session.
 *
 * Returns 410 (Gone) so old clients can detect the deprecation cleanly.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Manual payment requests are no longer supported. Use /api/payments/auto/create to start a gateway checkout.' },
    { status: 410 },
  )
}
