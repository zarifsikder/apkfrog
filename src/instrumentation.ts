/**
 * ApkForge — Next.js instrumentation hook.
 *
 * Runs once when a new server instance boots (including every Vercel
 * serverless cold start). Two idempotent steps:
 *
 *   1. Create missing tables if the database is fresh (auto-bootstrap, so
 *      no manual `prisma db push` is needed on Vercel).
 *   2. Seed a default admin user from env vars if the User table is empty.
 *      See src/lib/seed-admin.ts for the env vars used.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const url = process.env.DATABASE_URL || ''
  if (!url.startsWith('mysql:')) return // local SQLite dev — schema handled by prisma db push

  try {
    const { db } = await import('./lib/db')
    const { ensureDbReady } = await import('./lib/db-init')
    await ensureDbReady(db)

    // Step 2 — seed default admin (idempotent: only if User table is empty).
    const { seedAdminIfEmpty } = await import('./lib/seed-admin')
    await seedAdminIfEmpty(db)
  } catch (err) {
    // Never crash the server on bootstrap issues — log and continue.
    console.error('[db-init] auto bootstrap failed:', err instanceof Error ? err.message : err)
  }
}
