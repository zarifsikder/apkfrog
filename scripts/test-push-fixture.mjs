// Test fixture: create a successful build for the admin user (to test push send ownership)
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const user = await db.user.findUnique({ where: { email: 'zarif@apkforge.test' } })
  if (!user) throw new Error('admin user not found')
  const build = await db.build.create({
    data: {
      appName: 'My Demo App',
      packageName: 'com.apkforge.demopush',
      versionName: '1.0',
      versionCode: 1,
      sourceType: 'html',
      sourceMode: 'project',
      config: JSON.stringify({ pushNotifications: true }),
      status: 'success',
      progress: 100,
      currentStep: 'Done',
      logs: '[test] fixture build',
      apkSize: '1.2 MB',
      userId: user.id,
      completedAt: new Date(),
    },
  })
  console.log('created build', build.id, build.packageName, build.status)
}

main().finally(() => db.$disconnect())
