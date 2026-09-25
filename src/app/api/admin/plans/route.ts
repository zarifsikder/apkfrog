import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminEmail } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * Admin Panel → Plans tab — manage subscription plans (CRUD).
 * GET    /api/admin/plans         — list all plans (admin only, includes inactive)
 * POST   /api/admin/plans         — create a new plan
 */

const ACCENTS = ['violet', 'amber', 'emerald', 'fuchsia', 'slate']

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const plans = await db.plan.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
  return NextResponse.json({ plans })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  try {
    const body = await req.json()
    const name = (body.name || '').toString().trim()
    if (name.length < 2) return NextResponse.json({ error: 'Plan name must be at least 2 characters' }, { status: 400 })

    const price = Math.max(0, parseInt(body.price, 10) || 0)
    const priceYearly = Math.max(0, parseInt(body.priceYearly, 10) || 0)
    const description = (body.description || '').toString().slice(0, 300)
    const features = (body.features || '').toString().slice(0, 2000)
    const accent = ACCENTS.includes(body.accent) ? body.accent : 'violet'
    const isPopular = Boolean(body.isPopular)
    const isActive = body.isActive === undefined ? true : Boolean(body.isActive)
    const sortOrder = Math.max(0, parseInt(body.sortOrder, 10) || 0)

    const existing = await db.plan.findUnique({ where: { name } })
    if (existing) return NextResponse.json({ error: `Plan "${name}" already exists` }, { status: 400 })

    if (isPopular) {
      await db.plan.updateMany({ where: { isPopular: true }, data: { isPopular: false } })
    }

    const plan = await db.plan.create({
      data: { name, description, price, priceYearly, features, accent, isPopular, isActive, sortOrder },
    })
    publish('plans', { action: 'create', id: plan.id }, user.id)
    return NextResponse.json({ plan }, { status: 201 })
  } catch (e) {
    console.error('create plan error', e)
    return NextResponse.json({ error: 'Failed to create plan' }, { status: 500 })
  }
}
