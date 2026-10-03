/**
 * Task 20 — purge "Wevlo" from VISIBLE site data (MySQL), keep technical IDs.
 *  ✓ change: project display name (stale snapshot project), historical build
 *    display names, notifications, app-release notes, HTML demo footers
 *  ✗ keep:   login email, package names, file paths, file names, build logs
 *             (immutable history), GitHub repo setting, app-internal keys
 */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  // 1. stale "Wevlo Official App" project (old pre-rebrand snapshot, 0 builds —
  //    the live one is "ApkForge Official App" / 8all1l) → rename, don't delete
  const p = await db.project.updateMany({ where: { name: 'Wevlo Official App' }, data: { name: 'Official App (Legacy)' } })
  console.log('project renamed:', p.count)

  // 2. historical official-app build display names
  const b = await db.build.updateMany({ where: { appName: 'Wevlo' }, data: { appName: 'ApkForge' } })
  console.log('build appNames updated:', b.count)

  // 3. notifications
  const nts = await db.notification.findMany({ where: { OR: [{ title: { contains: 'Wevlo' } }, { body: { contains: 'Wevlo' } }] } })
  for (const n of nts) {
    await db.notification.update({
      where: { id: n.id },
      data: { title: n.title.replace(/Wevlo/g, 'ApkForge'), body: n.body.replace(/Wevlo/g, 'ApkForge') },
    })
  }
  console.log('notifications updated:', nts.length)

  // 4. app release notes (changelog text)
  const rels = await db.appRelease.findMany({ where: { OR: [{ notes: { contains: 'Wevlo' } }, { notes: { contains: 'WEVLO' } }] } })
  for (const r of rels) {
    await db.appRelease.update({ where: { id: r.id }, data: { notes: r.notes.replace(/Wevlo/g, 'ApkForge').replace(/WEVLO/g, 'APKFORGE') } })
  }
  console.log('app releases with notes fixed:', rels.length)

  // 5. HTML demo project footer
  const files = await db.projectFile.findMany({ where: { content: { contains: 'Built with Wevlo' } }, select: { id: true, path: true } })
  for (const f of files) {
    const row = await db.projectFile.findUnique({ where: { id: f.id } })
    await db.projectFile.update({ where: { id: f.id }, data: { content: row.content.replace('Built with Wevlo', 'Built with ApkForge') } })
  }
  console.log('html footers fixed:', files.length)
}
main().catch((e) => { console.error('✗', e.message?.slice(0, 300)); process.exitCode = 1 })
  .finally(() => db.$disconnect())
