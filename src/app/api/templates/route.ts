import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { seedTemplates } from '@/lib/projectTemplates'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().toLowerCase() || ''
  const category = url.searchParams.get('category')?.trim() || ''

  let count = await db.template.count()
  if (count === 0) {
    await db.template.createMany({ data: seedTemplates() })
    count = await db.template.count()
  }

  const templates = await db.template.findMany({
    where: {
      AND: [
        q ? { OR: [{ title: { contains: q } }, { author: { contains: q } }, { category: { contains: q } }] } : {},
        category && category !== 'All' ? { category } : {},
      ],
    },
    orderBy: [{ featured: 'desc' }, { views: 'desc' }],
  })
  const cats = await db.template.findMany({ select: { category: true }, distinct: ['category'] })
  return NextResponse.json({ templates, categories: cats.map((c) => c.category) })
}
