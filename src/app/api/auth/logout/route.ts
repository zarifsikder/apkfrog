import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clearSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('wv_session')?.value
  if (token) {
    await db.session.deleteMany({ where: { token } })
  }
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}
