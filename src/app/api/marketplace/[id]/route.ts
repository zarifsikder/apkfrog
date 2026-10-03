import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/marketplace/[id]
 * Get a single listing (and increment view counter)
 */
export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params

  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, name: true } },
      coupons: { where: { active: true }, select: { id: true, code: true, discountPercent: true, expiresAt: true, maxUses: true, usedCount: true } },
    },
  })
  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })

  // Don't increment seller's own view
  if (listing.sellerId !== user.id) {
    await db.listing.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {})
  }

  return NextResponse.json({
    listing: {
      ...listing,
      sellerName: listing.seller.name,
      sellerInitials: listing.seller.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U',
    },
  })
}

/**
 * PATCH /api/marketplace/[id]
 * Update a listing (only seller can). Body may include: title, description, price, category, tags, status, previewType, previewText, previewSub
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params

  const listing = await db.listing.findUnique({ where: { id } })
  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.sellerId !== user.id) {
    return NextResponse.json({ error: 'You can only edit your own listings' }, { status: 403 })
  }

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (typeof body.title === 'string' && body.title.trim().length >= 3) data.title = body.title.trim().slice(0, 80)
  if (typeof body.description === 'string') data.description = body.description.slice(0, 1000)
  if (body.price !== undefined) {
    const p = Math.max(0, Math.floor(Number(body.price) || 0))
    if (p <= 100000) data.price = p
  }
  if (typeof body.category === 'string') data.category = body.category.slice(0, 40)
  if (typeof body.tags === 'string') data.tags = body.tags.slice(0, 200)
  if (['active', 'paused', 'sold_out', 'taken_down'].includes(body.status)) data.status = body.status
  if (['gradient', 'code', 'dark', 'none'].includes(body.previewType)) data.previewType = body.previewType
  if (body.previewText !== undefined) data.previewText = body.previewText ? String(body.previewText).slice(0, 80) : null
  if (body.previewSub !== undefined) data.previewSub = body.previewSub ? String(body.previewSub).slice(0, 80) : null

  const updated = await db.listing.update({ where: { id }, data })
  publish('marketplace', { action: 'update', id }, user.id)
  return NextResponse.json({ listing: updated })
}

/**
 * DELETE /api/marketplace/[id]
 * Take down a listing (seller only). Sets status to 'taken_down'.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params

  const listing = await db.listing.findUnique({ where: { id } })
  if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  if (listing.sellerId !== user.id) {
    return NextResponse.json({ error: 'You can only delete your own listings' }, { status: 403 })
  }

  await db.listing.update({ where: { id }, data: { status: 'taken_down' } })
  publish('marketplace', { action: 'delete', id }, user.id)
  return NextResponse.json({ ok: true })
}
