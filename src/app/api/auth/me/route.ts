import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, publicUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ user: null }, { status: 200 })
  return NextResponse.json({ user: publicUser(user) })
}

export async function PATCH(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  try {
    const { name } = await req.json()
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 })
    }
    const fresh = await db.user.update({
      where: { id: user.id },
      data: { name: name.trim().slice(0, 60) }, // @updatedAt bumps automatically
    })
    publish('user', { action: 'update', id: user.id }, user.id)
    return NextResponse.json({ user: fresh ? publicUser(fresh) : null })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}
