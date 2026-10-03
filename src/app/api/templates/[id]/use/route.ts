import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'
import { defaultFilesFor } from '@/lib/projectTemplates'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { id } = await params
  const tpl = await db.template.findUnique({ where: { id } })
  if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  if (tpl.price > user.wallet) {
    return NextResponse.json(
      { error: `Insufficient wallet balance. This template costs ৳${tpl.price}. Please add money to your wallet.` },
      { status: 402 }
    )
  }

  // Deduct price (atomic-ish) and create the project from template
  if (tpl.price > 0) {
    await db.user.update({ where: { id: user.id }, data: { wallet: { decrement: tpl.price } } })
  }

  const project = await db.project.create({
    data: { name: tpl.title, type: 'html', userId: user.id },
  })

  const base = defaultFilesFor('html', tpl.title)
  const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tpl.title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app">
    <h1>${tpl.previewText || tpl.title}</h1>
    <p>${tpl.previewSub || 'Built with ApkForge'}</p>
    <button id="tapBtn">Get Started</button>
    <p id="msg"></p>
  </div>
  <script src="script.js"></script>
</body>
</html>
`
  await db.projectFile.createMany({
    data: [
      { path: 'index.html', language: 'html', content: indexContent, projectId: project.id },
      { path: 'style.css', language: 'css', content: base.find((f) => f.path === 'style.css')?.content || '', projectId: project.id },
      { path: 'script.js', language: 'javascript', content: base.find((f) => f.path === 'script.js')?.content || '', projectId: project.id },
    ],
  })

  await db.template.update({ where: { id: tpl.id }, data: { downloads: { increment: 1 } } })
  await db.notification.create({
    data: {
      userId: user.id,
      title: tpl.price > 0 ? 'Template purchased ✅' : 'Template added ✅',
      body: `"${tpl.title}" has been added to your projects${tpl.price > 0 ? ` (৳${tpl.price} deducted from wallet)` : ''}.`,
    },
  })

  const fresh = await db.user.findUnique({ where: { id: user.id } })
  const full = await db.project.findUnique({ where: { id: project.id }, include: { files: true } })
  publish('projects', { action: 'create', id: project.id }, user.id)
  publish('templates', { action: 'use', id: tpl.id }, user.id)
  publish('wallet', { wallet: fresh?.wallet ?? user.wallet }, user.id)
  publish('notifications', { action: 'new' }, user.id)
  return NextResponse.json({ project: full, wallet: fresh?.wallet ?? user.wallet }, { status: 201 })
}
