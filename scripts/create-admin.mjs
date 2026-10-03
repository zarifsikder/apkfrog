#!/usr/bin/env node
/**
 * Create (or update) an admin account with known credentials.
 *
 * Usage:
 *   node scripts/create-admin.mjs [email] [password] [name]
 *
 * Defaults:
 *   email    = admin@apkforge.dev
 *   password = Admin@1234
 *   name     = ApkForge Admin
 *
 * If a user with that email already exists, the script:
 *   - updates the password (hashed with the project's scrypt helper)
 *   - forces the role to ADMIN
 *   - kills all existing sessions so the new password + role take effect
 *
 * The admin can then log in at / and open More → Admin Panel.
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const db = new PrismaClient()

const ADMIN_EMAIL = (process.argv[2] || 'admin@apkforge.dev').trim().toLowerCase()
const ADMIN_PASSWORD = process.argv[3] || 'Admin@1234'
const ADMIN_NAME = (process.argv[4] || 'ApkForge Admin').slice(0, 60)

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function generatePublicId() {
  return 'AF-' + randomBytes(3).toString('hex').toUpperCase()
}

function generateReferralCode() {
  return 'AF' + randomBytes(3).toString('hex').toUpperCase()
}

async function main() {
  console.log('Target admin:', ADMIN_EMAIL)

  let user = await db.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (user) {
    // Update password + force role ADMIN + kill stale sessions
    await db.user.update({
      where: { id: user.id },
      data: { password: hashPassword(ADMIN_PASSWORD), role: 'ADMIN', name: ADMIN_NAME },
    })
    await db.session.deleteMany({ where: { userId: user.id } }).catch(() => {})
    console.log('✓ Existing account updated — password reset, role set to ADMIN.')
  } else {
    // Create new admin user
    let publicId = generatePublicId()
    for (let i = 0; i < 5; i++) {
      const clash = await db.user.findUnique({ where: { publicId }, select: { id: true } })
      if (!clash) break
      publicId = generatePublicId()
    }
    user = await db.user.create({
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: hashPassword(ADMIN_PASSWORD),
        publicId,
        referralCode: generateReferralCode(),
        role: 'ADMIN',
      },
    })
    await db.notification.create({
      data: {
        userId: user.id,
        title: 'Welcome, Admin 🛡️',
        body: 'Your admin account is ready. Open More → Admin Panel to manage users, plans, notifications, and the build engine.',
      },
    })
    console.log('✓ New admin account created.')
  }

  const totalAdmins = await db.user.count({ where: { role: 'ADMIN' } })
  console.log('\n========================================')
  console.log('  Admin login details')
  console.log('========================================')
  console.log('  URL:      http://localhost:3000/')
  console.log('  Email:    ' + ADMIN_EMAIL)
  console.log('  Password:  ' + ADMIN_PASSWORD)
  console.log('  Role:      ADMIN')
  console.log('  Name:      ' + ADMIN_NAME)
  console.log('  Total admins in DB: ' + totalAdmins)
  console.log('========================================')
  console.log('\nLogin → click "More" → "Admin Panel" to access the dashboard.')
}

main()
  .catch((e) => { console.error('Failed:', e); process.exit(1) })
  .finally(() => db.$disconnect())
