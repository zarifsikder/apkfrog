import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSession, setSessionCookie, generateReferralCode, publicUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, referral } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    const emailNorm = String(email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
    }

    const existing = await db.user.findUnique({ where: { email: emailNorm } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    let referredBy: string | undefined
    if (referral && typeof referral === 'string') {
      const refUser = await db.user.findUnique({ where: { referralCode: referral.trim().toUpperCase() } })
      if (refUser) referredBy = refUser.referralCode
    }

    const user = await db.user.create({
      data: {
        name: String(name).trim().slice(0, 60),
        email: emailNorm,
        password: hashPassword(password),
        referralCode: generateReferralCode(),
        referredBy,
      },
    })

    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Welcome to ApkForge 🎉',
        body: 'Your account is ready. Create your first project and build an APK in minutes — no coding required.',
      },
    })

    const { token, expiresAt } = await createSession(user.id)
    const res = NextResponse.json({ user: publicUser(user) }, { status: 201 })
    setSessionCookie(res, token, expiresAt)
    return res
  } catch (e) {
    console.error('register error', e)
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
  }
}
