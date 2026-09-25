import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, createSession, setSessionCookie, publicUser } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }
    const emailNorm = String(email).trim().toLowerCase()
    const user = await db.user.findUnique({ where: { email: emailNorm } })
    if (!user || !verifyPassword(String(password), user.password)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }
    if (user.banned) {
      return NextResponse.json({ error: 'Your account has been suspended. Contact support.' }, { status: 403 })
    }
    const { token, expiresAt } = await createSession(user.id)
    const res = NextResponse.json({ user: publicUser(user) })
    setSessionCookie(res, token, expiresAt)
    return res
  } catch (e) {
    console.error('login error', e)
    return NextResponse.json({ error: 'Login failed. Please try again.' }, { status: 500 })
  }
}
