// Seed default subscription plans (Free + Pro + Business) into the Plan table.
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  await db.plan.upsert({
    where: { name: 'Free' },
    update: {},
    create: {
      name: 'Free',
      description: 'Get started with everything you need to build your first APK.',
      price: 0,
      priceYearly: 0,
      features: 'Unlimited projects\n3 APK builds per day\nHTML/CSS/JS & Kotlin builds\nCommunity templates',
      accent: 'violet',
      isPopular: false,
      isActive: true,
      sortOrder: 0,
    },
  })

  await db.plan.upsert({
    where: { name: 'Pro' },
    update: {},
    create: {
      name: 'Pro',
      description: 'For serious builders — push notifications, monetization, no watermarks.',
      price: 499,
      priceYearly: 4990,
      features: 'Unlimited APK builds\nOneSignal push notifications\nAdMob monetization\nCustom branding & splash\nPriority build queue\nRemove ApkForge watermark',
      accent: 'fuchsia',
      isPopular: true,
      isActive: true,
      sortOrder: 1,
    },
  })

  await db.plan.upsert({
    where: { name: 'Business' },
    update: {},
    create: {
      name: 'Business',
      description: 'For teams & agencies shipping multiple apps every week.',
      price: 1499,
      priceYearly: 14990,
      features: 'Everything in Pro\nTeam seats (up to 5)\nDedicated build runner\nWhite-label dashboard\nPriority support',
      accent: 'amber',
      isPopular: false,
      isActive: true,
      sortOrder: 2,
    },
  })

  const count = await db.plan.count()
  console.log(`Seed complete — ${count} plan(s) in DB`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
