import { PrismaClient } from '@prisma/client'
import { ensureDbReady } from './db-init'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error'],
  })

// Safety net: if instrumentation did not run for some reason, bootstrap the
// database lazily in the background. ensureDbReady is idempotent + cached.
if (process.env.DATABASE_URL?.startsWith('mysql:')) {
  ensureDbReady(db).catch(() => {})
}

// Also seed the default admin if the database is empty. This works for both
// MySQL (production) and SQLite (local dev) — idempotent via the in-memory
// cache inside seedAdminIfEmpty. We don't await this so the first request
// isn't blocked; the admin will be available within milliseconds of startup.
void (async () => {
  try {
    const { seedAdminIfEmpty } = await import('./seed-admin')
    await seedAdminIfEmpty(db)
  } catch (err) {
    console.error('[db-init] seed admin failed:', err instanceof Error ? err.message : err)
  }
})()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db