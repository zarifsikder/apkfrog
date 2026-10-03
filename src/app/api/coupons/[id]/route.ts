import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/coupons/[id]
 * Update a coupon (only seller can). Body may include: discountPercent, maxUses, expiresAt, active
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params

  const coupon = await db.coupon.findUnique({ where: { id } })
  if (!coupon) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
  if (coupon.sellerId !== user.id) {
    return NextResponse.json({ error: 'You can only edit your own coupons' }, { status: 403 })
  }

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.discountPercent !== undefined) {
    data.discountPercent = Math.min(100, Math.max(1, Math.floor(Number(body.discountPercent) || 10)))
  }
  if (body.maxUses !== undefined) {
    data.maxUses = Math.max(0, Math.floor(Number(body.maxUses) || 0))
  }
  if (body.expiresAt !== undefined) {
    if (body.expiresAt === null) {
      data.expiresAt = null
    } else {
      const d = new Date(body.expiresAt)
      if (!isNaN(d.getTime()) && d > new Date()) data.expiresAt = d
    }
  }
  if (typeof body.active === 'boolean') data.active = body.active

  const updated = await db.coupon.update({ where: { id }, data })
  publish('marketplace', { action: 'coupon_update', id }, user.id)
  return NextResponse.json({ coupon: updated })
}

/**
 * DELETE /api/coupons/[id]
 * Permanently delete a coupon (only seller can).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params

  const coupon = await db.coupon.findUnique({ where: { id } })
  if (!coupon) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
  if (coupon.sellerId !== user.id) {
    return NextResponse.json({ error: 'You can only delete your own coupons' }, { status: 403 })
  }

  await db.coupon.delete({ where: { id } })
  publish('marketplace', { action: 'coupon_delete', id }, user.id)
  return NextResponse.json({ ok: true })
}
