import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

/**
 * ApkForge — auto admin seed.
 *
 * Called from instrumentation.ts on every server cold start. Idempotent:
 * only creates the default admin user the FIRST time the database is empty.
 * If the database already has any users, this does nothing — the bootstrap
 * rule from /api/auth/register (first registration becomes admin) takes over
 * from there.
 *
 * The admin credentials come from environment variables so they can be set
 * once in Vercel (or in .env locally) and never live in the code:
 *
 *   ADMIN_EMAIL    (default: admin@apkforge.dev)
 *   ADMIN_PASSWORD (default: Admin@1234)
 *   ADMIN_NAME     (default: ApkForge Admin)
 *
 * The defaults are intentionally weak + predictable so a fresh install
 * boots straight into admin. CHANGE THEM IN PRODUCTION by setting the
 * env vars. After first login, the password can be changed via the
 * Profile page (no special admin password change needed — same as users).
 */

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function generatePublicId(): string {
  return 'AF-' + randomBytes(3).toString('hex').toUpperCase()
}

function generateReferralCode(): string {
  return 'AF' + randomBytes(3).toString('hex').toUpperCase()
}

const cached = (globalThis as unknown as { __apkforgeAdminSeeded?: boolean }).__apkforgeAdminSeeded

export async function seedAdminIfEmpty(client: PrismaClient): Promise<void> {
  // Already attempted on this instance — don't keep re-querying on every request.
  if (cached) return

  try {
    // If there's at least one user already, do nothing — the existing
    // first-user-is-admin rule and admin-panel promotions own that flow.
    const userCount = await client.user.count().catch(() => -1)
    if (userCount !== 0) {
      ;(globalThis as unknown as { __apkforgeAdminSeeded?: boolean }).__apkforgeAdminSeeded = true
      return
    }

    const email = (process.env.ADMIN_EMAIL || 'admin@apkforge.dev').trim().toLowerCase()
    const password = process.env.ADMIN_PASSWORD || 'Admin@1234'
    const name = (process.env.ADMIN_NAME || 'ApkForge Admin').slice(0, 60)

    // Generate a unique publicId (retry on rare UNIQUE collisions)
    let publicId = generatePublicId()
    for (let i = 0; i < 5; i++) {
      const clash = await client.user.findUnique({ where: { publicId }, select: { id: true } }).catch(() => null)
      if (!clash) break
      publicId = generatePublicId()
    }

    await client.user.create({
      data: {
        name,
        email,
        password: hashPassword(password),
        publicId,
        referralCode: generateReferralCode(),
        role: 'ADMIN',
      },
    })

    // Optional welcome notification — wrapped in try/catch so it can never
    // crash the seed if the notifications table is not ready yet.
    const admin = await client.user.findUnique({ where: { email }, select: { id: true } }).catch(() => null)
    if (admin) {
      await client.notification
        .create({
          data: {
            userId: admin.id,
            title: 'Welcome, Admin 🛡️',
            body: 'Your admin account was auto-created by the database seed. Open More → Admin Panel to manage users, plans, notifications, and the build engine.',
          },
        })
        .catch(() => {})
    }

    // eslint-disable-next-line no-console
    console.log(`[seed-admin] Default admin created: ${email}`)
    ;(globalThis as unknown as { __apkforgeAdminSeeded?: boolean }).__apkforgeAdminSeeded = true
  } catch (err) {
    // Don't cache failures — allow retry on the next cold start.
    console.error('[seed-admin] failed:', err instanceof Error ? err.message : err)
  }
}
