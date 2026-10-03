import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const [projects, downloads] = await Promise.all([
    db.project.count({ where: { userId: user.id } }),
    db.build.count({ where: { userId: user.id, status: 'success' } }),
  ])
  return NextResponse.json({ stats: { projects, downloads, wallet: user.wallet, plan: user.plan } })
}
