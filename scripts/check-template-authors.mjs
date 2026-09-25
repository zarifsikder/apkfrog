import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const rows = await db.template.findMany({ select: { title: true, author: true, authorInitials: true } })
for (const r of rows) console.log(r.authorInitials, '|', r.author, '|', r.title)
await db.$disconnect()
