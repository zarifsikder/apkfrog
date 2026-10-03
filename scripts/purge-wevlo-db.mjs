/**
 * Task 20 — purge "Wevlo" from visible DB data (MySQL):
 *  1. Template rows: author "Wevlo Team" → "ApkForge Team", initials WT → AF
 *  2. Template.authorInitials column default → 'AF'
 *  3. Scan every table's text columns for any remaining Wevlo/WEVLO strings
 */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const TEXT_COLS = {
  User: ['id', 'email', 'name', 'password', 'plan', 'referralCode', 'referredBy'],
  Session: ['id', 'token', 'userId'],
  Project: ['id', 'name', 'type', 'userId'],
  ProjectFile: ['id', 'path', 'content', 'language', 'projectId'],
  Build: ['id', 'appName', 'packageName', 'versionName', 'sourceType', 'sourceMode', 'websiteUrl', 'zipPath', 'config', 'status', 'currentStep', 'logs', 'apkPath', 'apkSize', 'error', 'provider', 'runId', 'runUrl', 'artifactName', 'sourceSecret', 'sourceZip', 'userId', 'projectId'],
  Setting: ['key', 'value'],
  AppRelease: ['id', 'versionName', 'notes', 'fileName'],
  Template: ['id', 'title', 'author', 'authorInitials', 'category', 'previewType', 'previewText', 'previewSub'],
  Payment: ['id', 'userId', 'method', 'senderNumber', 'trxId', 'status', 'gateway', 'gatewayUrl'],
  Notification: ['id', 'userId', 'title', 'body'],
}

async function main() {
  // 1. template rows
  const u1 = await db.template.updateMany({ where: { author: 'Wevlo Team' }, data: { author: 'ApkForge Team' } })
  const u2 = await db.template.updateMany({ where: { authorInitials: 'WT' }, data: { authorInitials: 'AF' } })
  console.log(`template rows updated: author=${u1.count}, initials=${u2.count}`)

  // 2. column default
  await db.$executeRawUnsafe("ALTER TABLE `Template` ALTER COLUMN `authorInitials` SET DEFAULT 'AF'")
  console.log("Template.authorInitials default → 'AF'")

  // 3. full scan
  let found = 0
  for (const [table, cols] of Object.entries(TEXT_COLS)) {
    for (const col of cols) {
      const rows = await db.$queryRawUnsafe(
        `SELECT \`${col}\` AS v FROM \`${table}\` WHERE \`${col}\` LIKE '%Wevlo%' OR \`${col}\` LIKE '%WEVLO%' LIMIT 5`
      )
      for (const r of rows) { found++; console.log(`  HIT ${table}.${col}:`, String(r.v).slice(0, 90)) }
    }
  }
  console.log(found === 0 ? '✓ no Wevlo/WEVLO strings remain in any table' : `✗ ${found} hits above`)
}
main().catch((e) => { console.error('✗', e.message?.slice(0, 300)); process.exitCode = 1 })
  .finally(() => db.$disconnect())
