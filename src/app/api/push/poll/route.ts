import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const PKG_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/

// Called by the built APK (PushClient / PushReceiver) to fetch pending notifications.
// Public. Returns a plain JSON array (easy to parse with org.json on Android).
// Each returned notification is recorded as a PushDelivery — exactly-once per device.
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const packageName = (sp.get('packageName') || '').trim()
    const deviceId = (sp.get('deviceId') || '').trim()
    if (!PKG_RE.test(packageName) || deviceId.length < 8 || deviceId.length > 64) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }
    const build = await db.build.findFirst({ where: { packageName }, select: { userId: true } })
    if (!build) return NextResponse.json({ error: 'Unknown app' }, { status: 404 })

    // upsert — poll doubles as a heartbeat / defensive re-registration
    const device = await db.pushDevice.upsert({
      where: { packageName_deviceId: { packageName, deviceId } },
      update: { lastSeen: new Date() },
      create: { packageName, deviceId, userId: build.userId },
    })

    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000)
    const pending = await db.pushNotification.findMany({
      where: { packageName, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      take: 20,
      include: { deliveries: { where: { deviceId: device.id }, select: { id: true } } },
    })

    const origin = req.nextUrl.origin
    const out: Array<{ id: string; title: string; description: string; imageUrl: string; html: string; createdAt: string }> = []
    for (const n of pending) {
      if (n.deliveries.length > 0) continue // already delivered to this device
      try {
        await db.pushDelivery.create({ data: { notificationId: n.id, deviceId: device.id } })
      } catch {
        continue // another poller (foreground client vs background receiver) won the race
      }
      out.push({
        id: n.id,
        title: n.title,
        description: n.description,
        imageUrl: n.imageUrl ? new URL(n.imageUrl, origin).toString() : '',
        html: n.html || '',
        createdAt: n.createdAt.toISOString(),
      })
    }
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Poll failed' }, { status: 500 })
  }
}
