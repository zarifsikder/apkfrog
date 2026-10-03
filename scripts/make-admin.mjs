#!/usr/bin/env node
/**
 * Promote or demote a user by email.
 *
 * Usage:
 *   node scripts/make-admin.mjs <email>           → promote to ADMIN
 *   node scripts/make-admin.mjs <email> --demote  → demote to USER
 *   node scripts/make-admin.mjs --list            → list all admins
 *
 * Reads DATABASE_URL from .env (Prisma loads it automatically).
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)

  // --list: print every admin
  if (args.includes('--list')) {
    const admins = await db.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, name: true, email: true, publicId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    if (admins.length === 0) {
      console.log('No admins found. The first user to register on a fresh DB is auto-promoted.')
    } else {
      console.log(`Admins (${admins.length}):`)
      for (const a of admins) {
        console.log(`  ${a.email}  (${a.publicId})  — ${a.name}`)
      }
    }
    return
  }

  const email = args.find((a) => !a.startsWith('--'))
  const demote = args.includes('--demote')

  if (!email) {
    console.error('Usage: node scripts/make-admin.mjs <email> [--demote|--list]')
    process.exit(1)
  }

  const emailNorm = email.trim().toLowerCase()
  const user = await db.user.findUnique({ where: { email: emailNorm } })
  if (!user) {
    console.error(`✗ No user found with email "${emailNorm}"`)
    process.exit(1)
  }

  const newRole = demote ? 'USER' : 'ADMIN'

  if (user.role === newRole) {
    console.log(`• ${user.email} is already ${newRole} — nothing to do.`)
    return
  }

  // Demote safety: don't allow removing the last admin
  if (demote) {
    const adminCount = await db.user.count({ where: { role: 'ADMIN' } })
    if (adminCount <= 1) {
      console.error('✗ Cannot demote the last remaining admin. Promote another user first.')
      process.exit(1)
    }
  }

  await db.user.update({ where: { id: user.id }, data: { role: newRole } })

  // Kill sessions so the role change takes effect immediately
  await db.session.deleteMany({ where: { userId: user.id } }).catch(() => {})

  console.log(`✓ ${user.email} is now ${newRole}`)
}

main()
  .catch((e) => {
    console.error('Failed:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
