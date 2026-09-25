import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'
import { randomBytes } from 'crypto'

/**
 * GET /api/coupons
 * Returns the current user's coupons.
 * Optional: ?listingId=xyz  → filter coupons for a specific listing
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const url = new URL(req.url)
  const listingId = url.searchParams.get('listingId')

  const where: Record<string, unknown> = { sellerId: user.id }
  if (listingId) {
    where.OR = [{ listingId }, { listingId: null }]
  }

  const coupons = await db.coupon.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { listing: { select: { title: true } } },
  })

  return NextResponse.json({
    coupons: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      discountPercent: c.discountPercent,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      expiresAt: c.expiresAt,
      active: c.active,
      listingId: c.listingId,
      listingTitle: c.listing?.title || null,
      sellerId: c.sellerId,
      sellerName: user.name,
      createdAt: c.createdAt,
    })),
  })
}

/**
 * POST /api/coupons
 * Create a new coupon. Body: { code?, discountPercent, maxUses, expiresAt?, listingId?, active }
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  try {
    const body = await req.json()
    const { discountPercent, maxUses, expiresAt, listingId, active } = body

    // Generate a unique code if not provided
    let code = (body.code || '').toString().trim().toUpperCase()
    if (!code) {
      code = 'AF' + randomBytes(3).toString('hex').toUpperCase()
    }
    if (!/^[A-Z0-9]{3,30}$/.test(code)) {
      return NextResponse.json({ error: 'Code must be 3-30 chars (A-Z, 0-9)' }, { status: 400 })
    }

    const discount = Math.min(100, Math.max(1, Math.floor(Number(discountPercent) || 10)))
    const uses = Math.max(0, Math.floor(Number(maxUses) || 0))

    let expDate: Date | null = null
    if (expiresAt) {
      const d = new Date(expiresAt)
      if (!isNaN(d.getTime()) && d > new Date()) expDate = d
    }

    // If listingId provided, verify it belongs to the seller
    if (listingId) {
      const listing = await db.listing.findFirst({ where: { id: listingId, sellerId: user.id } })
      if (!listing) {
        return NextResponse.json({ error: 'Listing not found in your account' }, { status: 404 })
      }
    }

    // Check code uniqueness (case-insensitive)
    const existing = await db.coupon.findFirst({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: `Coupon code "${code}" already exists` }, { status: 400 })
    }

    const coupon = await db.coupon.create({
      data: {
        code,
        discountPercent: discount,
        maxUses: uses,
        expiresAt: expDate,
        active: active !== false,
        listingId: listingId || null,
        sellerId: user.id,
      },
      include: { listing: { select: { title: true } } },
    })

    publish('marketplace', { action: 'coupon_create', id: coupon.id }, user.id)

    return NextResponse.json({
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        expiresAt: coupon.expiresAt,
        active: coupon.active,
        listingId: coupon.listingId,
        listingTitle: coupon.listing?.title || null,
        sellerId: coupon.sellerId,
        sellerName: user.name,
        createdAt: coupon.createdAt,
      },
    }, { status: 201 })
  } catch (e) {
    console.error('create coupon error', e)
    return NextResponse.json({ error: 'Failed to create coupon' }, { status: 500 })
  }
}
