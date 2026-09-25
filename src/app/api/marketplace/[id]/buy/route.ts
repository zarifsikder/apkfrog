import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/marketplace/[id]/buy
 * Body: { couponCode?: string }
 *
 * Logic:
 * 1. Find active listing
 * 2. Verify buyer is not the seller
 * 3. Verify buyer hasn't already purchased (avoid double-charge for duplicate)
 * 4. Validate coupon (if provided) — must belong to this listing OR be a global coupon from the seller
 * 5. Compute discount & final price
 * 6. Check wallet balance
 * 7. Charge buyer, credit seller (90% — 10% platform fee), create purchase record
 * 8. Clone the project (files) into buyer's account
 * 9. Increment salesCount on listing, increment coupon usage
 * 10. Notify both parties
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params

  try {
    const body = await req.json().catch(() => ({}))
    const couponCode = (body?.couponCode || '').toString().trim().toUpperCase()

    const listing = await db.listing.findUnique({
      where: { id },
      include: { project: { include: { files: true } }, seller: true },
    })
    if (!listing) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    if (listing.status !== 'active') {
      return NextResponse.json({ error: 'This listing is not available for purchase' }, { status: 400 })
    }
    if (listing.sellerId === user.id) {
      return NextResponse.json({ error: 'You cannot buy your own listing' }, { status: 400 })
    }

    // Already purchased? Just give them back the project reference
    const existing = await db.purchase.findFirst({
      where: { listingId: listing.id, buyerId: user.id },
    })
    if (existing) {
      return NextResponse.json({ error: 'You already own this project', purchaseId: existing.id, projectId: existing.projectId }, { status: 400 })
    }

    // Validate coupon
    let coupon: Awaited<ReturnType<typeof db.coupon.findFirst>> = null
    let discountPercent = 0
    if (couponCode) {
      coupon = await db.coupon.findFirst({
        where: {
          code: couponCode,
          active: true,
          OR: [
            { listingId: listing.id },
            { listingId: null },
          ],
        },
      })
      if (!coupon) {
        return NextResponse.json({ error: `Coupon "${couponCode}" is not valid for this listing` }, { status: 400 })
      }
      if (coupon.expiresAt && coupon.expiresAt < new Date()) {
        return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 })
      }
      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
        return NextResponse.json({ error: 'This coupon has reached its usage limit' }, { status: 400 })
      }
      // Coupon must belong to this seller (or be a global coupon from this seller)
      if (coupon.sellerId !== listing.sellerId) {
        return NextResponse.json({ error: 'This coupon is not valid for this listing' }, { status: 400 })
      }
      discountPercent = Math.min(100, Math.max(0, coupon.discountPercent))
    }

    const originalPrice = listing.price
    const discountAmount = Math.floor((originalPrice * discountPercent) / 100)
    const finalPrice = originalPrice - discountAmount

    if (finalPrice > user.wallet) {
      return NextResponse.json({
        error: `Insufficient wallet balance. You need ৳${finalPrice} but have ৳${user.wallet}. Please top up your wallet.`,
        required: finalPrice,
        balance: user.wallet,
      }, { status: 402 })
    }

    // ── All checks passed — execute the transaction ──

    // 1. Charge buyer
    await db.user.update({
      where: { id: user.id },
      data: { wallet: { decrement: finalPrice } },
    })

    // 2. Credit seller (90% platform split — seller gets 90%, platform keeps 10%)
    const sellerEarnings = Math.floor(finalPrice * 0.9)
    await db.user.update({
      where: { id: listing.sellerId },
      data: { wallet: { increment: sellerEarnings } },
    })

    // 3. Clone the project into buyer's account
    const newProject = await db.project.create({
      data: {
        name: `${listing.title} (copy)`,
        type: listing.project.type,
        userId: user.id,
      },
    })
    if (listing.project.files.length > 0) {
      await db.projectFile.createMany({
        data: listing.project.files.map((f) => ({
          path: f.path,
          content: f.content,
          language: f.language,
          projectId: newProject.id,
        })),
      })
    }

    // 4. Create purchase record
    const purchase = await db.purchase.create({
      data: {
        listingId: listing.id,
        buyerId: user.id,
        sellerId: listing.sellerId,
        projectId: newProject.id,
        projectName: newProject.name,
        originalPrice,
        discount: discountAmount,
        finalPrice,
        couponCode: coupon?.code || null,
        couponId: coupon?.id || null,
      },
    })

    // 5. Increment listing sales & coupon usage
    await db.listing.update({
      where: { id: listing.id },
      data: { salesCount: { increment: 1 } },
    })
    if (coupon) {
      await db.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      })
    }

    // 6. Notifications for both parties
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Purchase successful 🎉',
        body: `You bought "${listing.title}" for ৳${finalPrice}${discountAmount > 0 ? ` (saved ৳${discountAmount})` : ''}. Project added to your account.`,
      },
    })
    await db.notification.create({
      data: {
        userId: listing.sellerId,
        title: 'You made a sale! 💰',
        body: `${user.name} bought "${listing.title}" for ৳${finalPrice}. You earned ৳${sellerEarnings} (after 10% platform fee).`,
      },
    })

    // 7. Real-time updates
    publish('marketplace', { action: 'purchase', id: listing.id }, user.id)
    publish('projects', { action: 'create', id: newProject.id }, user.id)
    publish('wallet', { wallet: user.wallet - finalPrice }, user.id)
    publish('wallet', { wallet: listing.seller.wallet + sellerEarnings }, listing.sellerId)
    publish('notifications', { action: 'new' }, user.id)
    publish('notifications', { action: 'new' }, listing.sellerId)

    const freshBuyer = await db.user.findUnique({ where: { id: user.id } })

    return NextResponse.json({
      purchase: {
        id: purchase.id,
        listingId: listing.id,
        listingTitle: listing.title,
        originalPrice,
        discount: discountAmount,
        finalPrice,
        couponCode: coupon?.code || null,
        projectId: newProject.id,
        sellerId: listing.sellerId,
        sellerName: listing.seller.name,
        buyerId: user.id,
        buyerName: user.name,
        createdAt: purchase.createdAt,
      },
      project: { id: newProject.id, name: newProject.name, type: newProject.type },
      wallet: freshBuyer?.wallet ?? user.wallet - finalPrice,
    }, { status: 201 })
  } catch (e) {
    console.error('buy listing error', e)
    return NextResponse.json({ error: 'Failed to complete purchase' }, { status: 500 })
  }
}
