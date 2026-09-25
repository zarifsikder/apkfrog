/**
 * Task 20 — sync the "ApkForge Official App" platform project (DB copy)
 * with the canonical sources in download/wevlo-native-app so future platform
 * builds of the official app use the fully rebranded files.
 * Update-existing-only: no creates, no deletes, name/type untouched.
 */
import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

const db = new PrismaClient()
const SRC = '/home/z/my-project/download/wevlo-native-app'

function walk(dir, base = dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(full, base))
    else out.push(path.relative(base, full).split(path.sep).join('/'))
  }
  return out
}

async function main() {
  const project = await db.project.findFirst({ where: { name: 'ApkForge Official App' } })
  if (!project) throw new Error('project not found')
  const files = await db.projectFile.findMany({ where: { projectId: project.id } })
  const byPath = new Map(files.map((f) => [f.path, f]))

  let updated = 0, identical = 0, missing = 0
  for (const rel of walk(SRC)) {
    const row = byPath.get(rel)
    if (!row) { missing++; continue }
    const fresh = fs.readFileSync(path.join(SRC, rel), 'utf8')
    if (fresh !== row.content) {
      await db.projectFile.update({ where: { id: row.id }, data: { content: fresh } })
      updated++
    } else identical++
  }
  console.log(`synced project ${project.id}: ${updated} updated, ${identical} identical, ${missing} files not in DB (skipped)`)
}
main().catch((e) => { console.error('✗', e.message?.slice(0, 300)); process.exitCode = 1 })
  .finally(() => db.$disconnect())
