// Removes inactive AppRelease records + their files (keeps only the active one)
import { PrismaClient } from '@prisma/client'
import { unlink } from 'fs/promises'
import path from 'path'

const db = new PrismaClient()
const DIR = path.join(process.cwd(), 'db', 'app-releases')

const stale = await db.appRelease.findMany({ where: { isActive: false } })
for (const r of stale) {
  await unlink(path.join(DIR, r.fileName)).catch(() => {})
  await db.appRelease.delete({ where: { id: r.id } })
  console.log('removed stale release', r.versionName, r.fileName)
}
const all = await db.appRelease.findMany()
console.log('remaining:', all.map((r) => `v${r.versionName} active=${r.isActive} ${r.fileName}`))
