import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const PKG_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/

// Called by the built APK (PushClient) to register a device / heartbeat.
// Public — the APK has no user session. Ownership is derived from the Build record.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const packageName = String(body.packageName || '').trim()
    const deviceId = String(body.deviceId || '').trim()
    const model = String(body.model || '').slice(0, 64)
    if (!PKG_RE.test(packageName) || deviceId.length < 8 || deviceId.length > 64) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    const build = await db.build.findFirst({ where: { packageName }, select: { userId: true } })
    if (!build) {
      return NextResponse.json({ error: 'Unknown app' }, { status: 404 })
    }
    await db.pushDevice.upsert({
      where: { packageName_deviceId: { packageName, deviceId } },
      update: { lastSeen: new Date(), model },
      create: { packageName, deviceId, model, userId: build.userId },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
