import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'

// Apps the user can push to — distinct successful builds + connected device count
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const builds = await db.build.findMany({
    where: { userId: user.id, status: 'success' },
    orderBy: { createdAt: 'desc' },
    select: { packageName: true, appName: true, createdAt: true },
  })
  const apps: Array<{ packageName: string; appName: string; devices: number; lastBuiltAt: string }> = []
  const seen = new Set<string>()
  for (const b of builds) {
    if (seen.has(b.packageName)) continue
    seen.add(b.packageName)
    const devices = await db.pushDevice.count({ where: { packageName: b.packageName } })
    apps.push({ packageName: b.packageName, appName: b.appName, devices, lastBuiltAt: b.createdAt.toISOString() })
  }
  return NextResponse.json({ apps })
}
