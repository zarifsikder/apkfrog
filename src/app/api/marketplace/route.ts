import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * GET /api/marketplace
 * Browse all active listings. Optional query params: q, category, sort, sellerId
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().toLowerCase() || ''
  const category = url.searchParams.get('category')?.trim() || ''
  const sort = url.searchParams.get('sort') || 'newest'
  const sellerId = url.searchParams.get('sellerId') || ''

  const where: Record<string, unknown> = { status: 'active' }
  if (sellerId) where.sellerId = sellerId
  if (category && category !== 'All') where.category = category
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { description: { contains: q } },
      { tags: { contains: q } },
    ]
  }

  let orderBy: Record<string, 'desc' | 'asc'>[] = [{ createdAt: 'desc' }]
  if (sort === 'popular') orderBy = [{ salesCount: 'desc' }, { views: 'desc' }]
  else if (sort === 'price_low') orderBy = [{ price: 'asc' }]
  else if (sort === 'price_high') orderBy = [{ price: 'desc' }]
  else if (sort === 'rating') orderBy = [{ rating: 'desc' }]

  const listings = await db.listing.findMany({
    where,
    orderBy,
    include: {
      seller: { select: { id: true, name: true } },
    },
    take: 100,
  })

  const result = listings.map((l) => ({
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
    sellerId: l.sellerId,
    sellerName: l.seller.name,
    sellerInitials: l.seller.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U',
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  }))

  const cats = await db.listing.findMany({
    where: { status: 'active' },
    select: { category: true },
    distinct: ['category'],
  })

  return NextResponse.json({
    listings: result,
    categories: cats.map((c) => c.category).sort(),
  })
}

/**
 * POST /api/marketplace
 * Publish a new listing for sale.
 * Body: { projectId, title, description, price, category, tags, previewType, previewText, previewSub }
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  try {
    const body = await req.json()
    const {
      projectId, title, description, price, category, tags,
      previewType, previewText, previewSub,
    } = body

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    }
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }
    const priceNum = Math.max(0, Math.floor(Number(price) || 0))
    if (priceNum > 100000) {
      return NextResponse.json({ error: 'Price cannot exceed ৳100,000' }, { status: 400 })
    }

    const project = await db.project.findFirst({ where: { id: projectId, userId: user.id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found in your account' }, { status: 404 })
    }

    const existing = await db.listing.findFirst({
      where: { projectId, status: { in: ['active', 'paused'] } },
    })
    if (existing) {
      return NextResponse.json({ error: 'This project is already listed for sale' }, { status: 400 })
    }

    const cleanTags = (tags || '').toString().slice(0, 200)
    const cleanCategory = (category || 'General').toString().slice(0, 40)
    const validPreviews = ['gradient', 'code', 'dark', 'none']
    const cleanPreviewType = validPreviews.includes(previewType) ? previewType : 'gradient'

    const listing = await db.listing.create({
      data: {
        title: title.trim().slice(0, 80),
        description: (description || '').toString().slice(0, 1000),
        price: priceNum,
        category: cleanCategory,
        tags: cleanTags,
        previewType: cleanPreviewType,
        previewText: previewText ? previewText.toString().slice(0, 80) : null,
        previewSub: previewSub ? previewSub.toString().slice(0, 80) : null,
        projectId,
        sellerId: user.id,
        status: 'active',
      },
      include: { seller: { select: { name: true } } },
    })

    publish('marketplace', { action: 'create', id: listing.id }, user.id)

    return NextResponse.json({
      listing: {
        ...listing,
        sellerName: listing.seller.name,
        sellerInitials: listing.seller.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() || 'U',
      },
    }, { status: 201 })
  } catch (e) {
    console.error('create listing error', e)
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 })
  }
}
