import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

/**
 * GET /api/marketplace/my
 * Returns the current user's listings (as seller) AND purchases (as buyer).
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const [listings, purchases, sales] = await Promise.all([
    db.listing.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { project: { select: { name: true, type: true } } },
    }),
    db.purchase.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: { select: { name: true } },
        listing: { select: { title: true, previewType: true, previewText: true, previewSub: true } },
      },
    }),
    db.purchase.findMany({
      where: { sellerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { buyer: { select: { name: true } }, listing: { select: { title: true } } },
    }),
  ])

  return NextResponse.json({
    listings: listings.map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description,
      price: l.price,
      category: l.category,
      tags: l.tags,
      previewType: l.previewType,
      previewText: l.previewText,
      previewSub: l.previewSub,
      status: l.status,
      salesCount: l.salesCount,
      views: l.views,
      rating: l.rating,
      ratingCount: l.ratingCount,
      projectId: l.projectId,
      projectName: l.project?.name,
      projectType: l.project?.type,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    })),
    purchases: purchases.map((p) => ({
      id: p.id,
      listingId: p.listingId,
      listingTitle: p.listing?.title || '',
      previewType: p.listing?.previewType || 'gradient',
      previewText: p.listing?.previewText || null,
      previewSub: p.listing?.previewSub || null,
      originalPrice: p.originalPrice,
      discount: p.discount,
      finalPrice: p.finalPrice,
      couponCode: p.couponCode,
      projectId: p.projectId,
      projectName: p.projectName,
      sellerId: p.sellerId,
      sellerName: p.seller?.name || 'Unknown',
      createdAt: p.createdAt,
    })),
    sales: sales.map((s) => ({
      id: s.id,
      listingId: s.listingId,
      listingTitle: s.listing?.title || '',
      originalPrice: s.originalPrice,
      discount: s.discount,
      finalPrice: s.finalPrice,
      earnings: Math.floor(s.finalPrice * 0.9),
      couponCode: s.couponCode,
      buyerId: s.buyerId,
      buyerName: s.buyer?.name || 'Unknown',
      projectId: s.projectId,
      projectName: s.projectName,
      createdAt: s.createdAt,
    })),
  })
}
