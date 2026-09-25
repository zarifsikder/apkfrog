import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

const PKG_RE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/

// Send a push notification to every installed device of one of your built apps.
// Body: { packageName, title, description?, imageUrl?, html? }
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  try {
    const body = await req.json().catch(() => ({}))
    const packageName = String(body.packageName || '').trim()
    const title = String(body.title || '').trim()
    const description = String(body.description || '').trim()
    const imageUrl = String(body.imageUrl || '').trim()
    const html = String(body.html || '').trim()

    if (!PKG_RE.test(packageName)) {
      return NextResponse.json({ error: 'Invalid package name' }, { status: 400 })
    }
    if (!title || title.length > 100) {
      return NextResponse.json({ error: 'Title is required (max 100 characters)' }, { status: 400 })
    }
    if (description.length > 500) {
      return NextResponse.json({ error: 'Description is too long (max 500 characters)' }, { status: 400 })
    }
    if (html.length > 20000) {
      return NextResponse.json({ error: 'Custom HTML is too long (max 20000 characters)' }, { status: 400 })
    }
    if (imageUrl && !/^(https?:\/\/|\/api\/push\/image\/)/i.test(imageUrl)) {
      return NextResponse.json({ error: 'Image must be a URL or an uploaded image' }, { status: 400 })
    }

    // ownership — only apps the user actually built (successful build exists)
    const build = await db.build.findFirst({
      where: { userId: user.id, packageName, status: 'success' },
      select: { id: true, appName: true },
    })
    if (!build) {
      return NextResponse.json(
        { error: 'You can only send push notifications to apps you have built successfully' },
        { status: 403 }
      )
    }

    const notification = await db.pushNotification.create({
      data: {
        userId: user.id,
        packageName,
        title,
        description,
        imageUrl: imageUrl || null,
        html: html || null,
      },
    })
    publish('push', { action: 'send', id: notification.id, packageName }, user.id)
    return NextResponse.json({ notification }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Could not send the notification' }, { status: 500 })
  }
}
