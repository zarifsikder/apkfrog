import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized, isAdminEmail } from '@/lib/auth'

/**
 * GET    /api/templates/[id]  — get single template
 * PUT    /api/templates/[id]  — update template (admin only)
 * DELETE /api/templates/[id]  — delete template (admin only)
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const template = await db.template.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  await db.template.update({ where: { id }, data: { views: { increment: 1 } } })
  return NextResponse.json({ template })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const { id } = await params
  try {
    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (typeof body.title === 'string') data.title = body.title.slice(0, 255)
    if (typeof body.author === 'string') data.author = body.author.slice(0, 255)
    if (typeof body.category === 'string') data.category = body.category
    if (typeof body.price !== 'undefined') data.price = Math.max(0, parseInt(body.price) || 0)
    if (typeof body.featured !== 'undefined') data.featured = Boolean(body.featured)
    if (typeof body.previewType === 'string') data.previewType = body.previewType
    if (typeof body.previewText !== 'undefined') data.previewText = body.previewText
    if (typeof body.previewSub !== 'undefined') data.previewSub = body.previewSub
    const template = await db.template.update({ where: { id }, data })
    return NextResponse.json({ template })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const { id } = await params
  try {
    await db.template.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }
}
