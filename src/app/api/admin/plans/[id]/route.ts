import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminEmail } from '@/lib/auth'
import { publish } from '@/lib/events'

/**
 * Admin Panel → Plans tab — single plan CRUD.
 * PUT    /api/admin/plans/[id]   — update plan
 * DELETE /api/admin/plans/[id]   — delete plan
 */

const ACCENTS = ['violet', 'amber', 'emerald', 'fuchsia', 'slate']

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { id } = await params
  try {
    const body = await req.json()

    const existing = await db.plan.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    const data: Record<string, unknown> = {}
    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (name.length < 2) return NextResponse.json({ error: 'Plan name must be at least 2 characters' }, { status: 400 })
      const dup = await db.plan.findUnique({ where: { name } })
      if (dup && dup.id !== id) return NextResponse.json({ error: `Plan "${name}" already exists` }, { status: 400 })
      data.name = name
    }
    if (typeof body.description === 'string') data.description = body.description.slice(0, 300)
    if (body.price !== undefined) data.price = Math.max(0, parseInt(body.price, 10) || 0)
    if (body.priceYearly !== undefined) data.priceYearly = Math.max(0, parseInt(body.priceYearly, 10) || 0)
    if (typeof body.features === 'string') data.features = body.features.slice(0, 2000)
    if (typeof body.accent === 'string') data.accent = ACCENTS.includes(body.accent) ? body.accent : 'violet'
    if (body.isPopular !== undefined) {
      data.isPopular = Boolean(body.isPopular)
      if (data.isPopular) {
        await db.plan.updateMany({ where: { isPopular: true, NOT: { id } }, data: { isPopular: false } })
      }
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)
    if (body.sortOrder !== undefined) data.sortOrder = Math.max(0, parseInt(body.sortOrder, 10) || 0)

    const plan = await db.plan.update({ where: { id }, data })
    publish('plans', { action: 'update', id }, user.id)
    return NextResponse.json({ plan })
  } catch (e) {
    console.error('update plan error', e)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { id } = await params
  try {
    const existing = await db.plan.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    if (existing.name.toLowerCase() === 'free') {
      return NextResponse.json({ error: 'The Free plan cannot be deleted (it is the default tier for new users)' }, { status: 400 })
    }

    await db.plan.delete({ where: { id } })
    await db.user.updateMany({ where: { plan: existing.name }, data: { plan: 'Free' } })

    publish('plans', { action: 'delete', id }, user.id)
    publish('user', { action: 'plan-changed' }, user.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('delete plan error', e)
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 })
  }
}
