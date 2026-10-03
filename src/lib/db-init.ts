import type { PrismaClient } from '@prisma/client'
import { CREATE_TABLES, FOREIGN_KEYS, TABLE_NAMES } from './db-init-ddl'

/**
 * ApkForge — auto database bootstrap.
 *
 * ensureDbReady() runs on every server start (instrumentation.ts) and:
 *   1. Fast path: counts how many of the 18 expected tables already exist
 *      (single information_schema query — near zero cost when the DB is set up).
 *   2. If anything is missing, creates all tables with CREATE TABLE IF NOT
 *      EXISTS and adds any missing foreign keys.
 *
 * The result is cached per server instance, and failures are not cached so
 * the next request can retry. Safe to call concurrently — every statement is
 * idempotent, so racing serverless cold starts cannot corrupt anything.
 */

const globalForDbInit = globalThis as unknown as {
  __apkforgeDbReady?: Promise<void>
}

export function ensureDbReady(client: PrismaClient): Promise<void> {
  const cached = globalForDbInit.__apkforgeDbReady
  if (cached) return cached

  const p = run(client).catch((err) => {
    // Do not cache failures — allow a retry on the next cold start/request.
    globalForDbInit.__apkforgeDbReady = undefined
    throw err
  })
  globalForDbInit.__apkforgeDbReady = p
  return p
}

async function run(client: PrismaClient): Promise<void> {
  // 1. Fast existence check — one query, no DDL when the schema is already there.
  const list = TABLE_NAMES.map((t) => `'${t}'`).join(', ')
  const rows = (await client.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name IN (${list})`
  )) as Array<{ c: bigint | number }>
  const count = Number(rows?.[0]?.c ?? 0)
  if (count >= TABLE_NAMES.length) return

  // 2. Create every missing table (IF NOT EXISTS → idempotent).
  for (const sql of CREATE_TABLES) {
    await client.$executeRawUnsafe(sql)
  }

  // 3. Add foreign keys that do not exist yet.
  const existing = new Set<string>()
  try {
    const fkRows = (await client.$queryRawUnsafe(
      `SELECT CONSTRAINT_NAME AS name FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY' AND constraint_schema = DATABASE()`
    )) as Array<{ name: string }>
    for (const r of fkRows) existing.add(String(r.name).toLowerCase())
  } catch {
    // information_schema unavailable → fall through, each ALTER guarded below.
  }
  for (const fk of FOREIGN_KEYS) {
    if (existing.has(fk.name.toLowerCase())) continue
    await client.$executeRawUnsafe(fk.sql).catch(() => {
      // Already exists / raced with another instance → ignore.
    })
  }
}
