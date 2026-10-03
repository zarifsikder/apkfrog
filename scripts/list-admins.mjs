import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
try {
  const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, name: true, email: true, role: true, createdAt: true } })
  console.log('Admins in dev.db:')
  for (const a of admins) console.log(' -', a.email, '|', a.name, '| created', a.createdAt.toISOString())
  const total = await db.user.count()
  console.log('Total users:', total)
} catch (e) {
  console.error('ERROR:', e.message)
} finally {
  await db.$disconnect()
}
