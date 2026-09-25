// Seed a default admin user for Vercel deployment
// Usage: node scripts/seed-admin.mjs
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const db = new PrismaClient()

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function main() {
  const email = process.env.ADMIN_EMAIL || 'zarif@apkforge.test'
  const password = process.env.ADMIN_PASSWORD || 'secret123'

  await db.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Admin',
      password: hashPassword(password),
      wallet: 9999,
      plan: 'Pro',
      referralCode: 'ADMIN001',
    },
  })

  console.log(`Admin user ready: ${email} / ${password}`)
  console.log('Run "node scripts/seed-plans.mjs" to add subscription plans.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
