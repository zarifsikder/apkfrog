import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import type { User } from '@prisma/client'

export const SESSION_COOKIE = 'wv_session'
const SESSION_DAYS = 30

/**
 * Admin status is determined entirely from the database `role` column.
 * A user is an admin iff `user.role === 'ADMIN'`.
 *
 * The first user to register on a fresh database is auto-promoted to ADMIN
 * (see /api/auth/register) so that the platform has a bootstrap admin without
 * any hardcoded email. Subsequent admins are promoted through the admin
 * panel or the `scripts/make-admin.mjs` CLI.
 */
export function isAdminUser(user?: { role?: string } | null): boolean {
  return !!user && user.role === 'ADMIN'
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const original = Buffer.from(hash, 'hex')
  return candidate.length === original.length && timingSafeEqual(candidate, original)
}

export function generateToken(): string {
  return randomBytes(32).toString('hex')
}

export function generateReferralCode(): string {
  return 'AF' + randomBytes(3).toString('hex').toUpperCase()
}

/**
 * Generate a unique, user-facing public ID — format: AF-XXXXXX (6 hex chars).
 * This is shown on the Profile page and used as a stable, shareable account
 * identifier (e.g. for support tickets, admin lookups, public profile URLs).
 * The function does NOT guarantee global uniqueness on its own — the register
 * route retries until the DB accepts the value (UNIQUE constraint).
 */
export function generatePublicId(): string {
  return 'AF-' + randomBytes(3).toString('hex').toUpperCase()
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.session.create({ data: { token, userId, expiresAt } })
  return { token, expiresAt }
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    expires: expiresAt,
    path: '/',
  })
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', expires: new Date(0) })
}

export async function getUser(req: NextRequest): Promise<User | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({ where: { token }, include: { user: true } })
  if (!session) return null
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  // Suspended users (Admin Panel → Users) are locked out of every authed API
  if (session.user.banned) return null
  return session.user
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized. Please login again.' }, { status: 401 })
}

export function publicUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    wallet: user.wallet,
    plan: user.plan,
    referralCode: user.referralCode,
    publicId: user.publicId || 'AF-000000',
    role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
    createdAt: user.createdAt,
  }
}
