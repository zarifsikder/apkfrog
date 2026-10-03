import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

// Delete a sent push notification record (owner only)
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const notification = await db.pushNotification.findUnique({ where: { id } })
  if (!notification) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (notification.userId !== user.id) {
    return NextResponse.json({ error: 'Not your notification' }, { status: 403 })
  }
  await db.pushNotification.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
