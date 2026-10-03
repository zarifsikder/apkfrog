import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

/**
 * POST /api/coupons/validate
 * Body: { code, listingId }
 * Returns: { valid, discountPercent, discountAmount, finalPrice, originalPrice, reason? }
 *
 * Used to preview the discount BEFORE the buyer commits.
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  try {
    const { code, listingId } = await req.json()
    if (!code || !listingId) {
      return NextResponse.json({ valid: false, reason: 'Code and listingId required' }, { status: 400 })
    }

    const upperCode = code.toString().trim().toUpperCase()
    const listing = await db.listing.findUnique({ where: { id: listingId } })
    if (!listing || listing.status !== 'active') {
      return NextResponse.json({ valid: false, reason: 'Listing not available' }, { status: 404 })
    }

    if (listing.sellerId === user.id) {
      return NextResponse.json({ valid: false, reason: 'You cannot use coupons on your own listing' }, { status: 400 })
    }

    const coupon = await db.coupon.findFirst({
      where: {
        code: upperCode,
        active: true,
        OR: [{ listingId }, { listingId: null }],
      },
    })

    if (!coupon) {
      return NextResponse.json({ valid: false, reason: 'Coupon not found for this listing' })
    }
    if (coupon.sellerId !== listing.sellerId) {
      return NextResponse.json({ valid: false, reason: 'Coupon not valid for this listing' })
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      return NextResponse.json({ valid: false, reason: 'Coupon has expired' })
    }
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ valid: false, reason: 'Coupon usage limit reached' })
    }

    const originalPrice = listing.price
    const discountAmount = Math.floor((originalPrice * coupon.discountPercent) / 100)
    const finalPrice = originalPrice - discountAmount

    return NextResponse.json({
      valid: true,
      code: upperCode,
      discountPercent: coupon.discountPercent,
      discountAmount,
      originalPrice,
      finalPrice,
      savings: discountAmount,
    })
  } catch (e) {
    console.error('validate coupon error', e)
    return NextResponse.json({ valid: false, reason: 'Failed to validate coupon' }, { status: 500 })
  }
}
