/**
 * ApkForge — MySQL ops helper (import DDL / check tables without a mysql CLI)
 * Subcommands:
 *   test   — test connection + show server version
 *   import — run the DDL (download/ApkForge-MySQL-Database.sql) statement-by-statement
 *   tables — list tables + row counts
 *
 * Uses the default Prisma client (MySQL — prisma/schema.prisma).
 * URL resolution: $MYSQL_URL, else $DATABASE_URL when it starts with mysql://.
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'

const URL = process.env.MYSQL_URL || ((process.env.DATABASE_URL || '').startsWith('mysql') ? process.env.DATABASE_URL : null)
if (!URL) { console.error('✗ Set MYSQL_URL (or a mysql:// DATABASE_URL)'); process.exit(1) }
const db = new PrismaClient({ datasources: { db: { url: URL } } })
const cmd = process.argv[2]

async function main() {
  if (cmd === 'test') {
    const v = await db.$queryRaw`SELECT VERSION() as v, DATABASE() as d`
    console.log('✓ connected — server', v[0].v, '| database', v[0].d)
  } else if (cmd === 'import') {
    const sql = readFileSync('download/ApkForge-MySQL-Database.sql', 'utf8')
    // strip comment lines, split on ; at end of statement
    const cleaned = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n')
    const stmts = cleaned.split(';').map((s) => s.trim()).filter(Boolean)
    for (const s of stmts) {
      const first = s.slice(0, 60).replace(/\s+/g, ' ')
      try { await db.$executeRawUnsafe(s); console.log('  ✓', first) }
      catch (e) { console.error('  ✗', first, '→', e.message.slice(0, 160)); throw e }
    }
    console.log(`✓ DDL import complete (${stmts.length} statements)`)
  } else if (cmd === 'tables') {
    const t = await db.$queryRaw`SHOW TABLES`
    console.log('tables:', t.length)
    for (const row of t) {
      const name = Object.values(row)[0]
      const c = await db.$queryRawUnsafe(`SELECT COUNT(*) as n FROM \`${name}\``)
      console.log('  •', name, '—', c[0].n, 'rows')
    }
  } else {
    console.error('unknown subcommand'); process.exit(1)
  }
}
main().catch((e) => { console.error('✗', e.message?.slice(0, 400) || e); process.exitCode = 1 })
  .finally(() => db.$disconnect())
