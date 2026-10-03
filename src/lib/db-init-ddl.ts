/**
 * ApkForge — Auto DDL for MySQL (Vercel-ready)
 *
 * Runs automatically on server startup (src/instrumentation.ts) and creates
 * every table if it does not exist yet, so a fresh MySQL database is
 * bootstrapped without running any SQL or `prisma db push` manually.
 *
 * All statements are idempotent: CREATE TABLE IF NOT EXISTS + FK existence
 * checks, so it is safe to run on every cold start / every instance.
 */

export const TABLE_NAMES = [
  'users',
  'sessions',
  'projects',
  'project_files',
  'builds',
  'settings',
  'app_releases',
  'templates',
  'payments',
  'notifications',
  'notification_comments',
  'push_notifications',
  'push_devices',
  'push_deliveries',
  'plans',
  'listings',
  'purchases',
  'coupons',
  'reviews',
] as const

export const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`email\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`password\` VARCHAR(191) NOT NULL,
    \`wallet\` INTEGER NOT NULL DEFAULT 0,
    \`plan\` VARCHAR(191) NOT NULL DEFAULT 'Free',
    \`role\` VARCHAR(191) NOT NULL DEFAULT 'USER',
    \`banned\` BOOLEAN NOT NULL DEFAULT false,
    \`referralCode\` VARCHAR(191) NOT NULL DEFAULT 'REF0000',
    \`publicId\` VARCHAR(191) NOT NULL DEFAULT 'AF-000000',
    \`referredBy\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`users_email_key\`(\`email\`),
    UNIQUE INDEX \`users_referralCode_key\`(\`referralCode\`),
    UNIQUE INDEX \`users_publicId_key\`(\`publicId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`sessions\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`token\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`expiresAt\` DATETIME(3) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX \`sessions_token_key\`(\`token\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`projects\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`type\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`project_files\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`path\` VARCHAR(191) NOT NULL,
    \`content\` LONGTEXT NOT NULL,
    \`language\` VARCHAR(191) NOT NULL DEFAULT 'plaintext',
    \`projectId\` VARCHAR(191) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`builds\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`appName\` VARCHAR(191) NOT NULL,
    \`packageName\` VARCHAR(191) NOT NULL,
    \`versionName\` VARCHAR(191) NOT NULL DEFAULT '1.0',
    \`versionCode\` INTEGER NOT NULL DEFAULT 1,
    \`sourceType\` VARCHAR(191) NOT NULL,
    \`sourceMode\` VARCHAR(191) NOT NULL DEFAULT 'project',
    \`websiteUrl\` TEXT NULL,
    \`zipPath\` TEXT NULL,
    \`config\` TEXT NOT NULL DEFAULT ('{}'),
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'queued',
    \`progress\` INTEGER NOT NULL DEFAULT 0,
    \`currentStep\` VARCHAR(191) NOT NULL DEFAULT 'Connect',
    \`logs\` LONGTEXT NOT NULL,
    \`apkPath\` TEXT NULL,
    \`apkSize\` TEXT NULL,
    \`error\` TEXT NULL,
    \`provider\` VARCHAR(191) NOT NULL DEFAULT 'github',
    \`runId\` TEXT NULL,
    \`runUrl\` TEXT NULL,
    \`artifactName\` TEXT NULL,
    \`sourceSecret\` TEXT NULL,
    \`sourceZip\` LONGTEXT NULL,
    \`dispatchedAt\` DATETIME(3) NULL,
    \`syncedAt\` DATETIME(3) NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`projectId\` VARCHAR(191) NULL,
    \`startedAt\` DATETIME(3) NULL,
    \`completedAt\` DATETIME(3) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`builds_userId_idx\`(\`userId\`),
    INDEX \`builds_status_idx\`(\`status\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`settings\` (
    \`key\` VARCHAR(191) NOT NULL,
    \`value\` LONGTEXT NOT NULL,
    \`updatedAt\` DATETIME(3) NOT NULL,
    PRIMARY KEY (\`key\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`app_releases\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`versionName\` VARCHAR(191) NOT NULL,
    \`versionCode\` INTEGER NOT NULL DEFAULT 1,
    \`notes\` TEXT NOT NULL,
    \`fileName\` VARCHAR(191) NOT NULL,
    \`size\` INTEGER NOT NULL DEFAULT 0,
    \`downloads\` INTEGER NOT NULL DEFAULT 0,
    \`isActive\` BOOLEAN NOT NULL DEFAULT true,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`templates\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`author\` VARCHAR(191) NOT NULL,
    \`authorInitials\` VARCHAR(191) NOT NULL DEFAULT 'WV',
    \`price\` INTEGER NOT NULL DEFAULT 0,
    \`category\` VARCHAR(191) NOT NULL DEFAULT 'General',
    \`views\` INTEGER NOT NULL DEFAULT 0,
    \`downloads\` INTEGER NOT NULL DEFAULT 0,
    \`featured\` BOOLEAN NOT NULL DEFAULT false,
    \`previewType\` VARCHAR(191) NOT NULL DEFAULT 'none',
    \`previewText\` TEXT NULL,
    \`previewSub\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`payments\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`amount\` INTEGER NOT NULL,
    \`method\` VARCHAR(191) NOT NULL,
    \`senderNumber\` VARCHAR(191) NOT NULL,
    \`trxId\` VARCHAR(191) NOT NULL,
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'pending',
    \`gateway\` VARCHAR(191) NOT NULL DEFAULT 'manual',
    \`gatewayUrl\` TEXT NULL,
    \`verifiedAt\` DATETIME(3) NULL,
    \`pendingPlanId\` VARCHAR(191) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`payments_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`notifications\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`body\` TEXT NOT NULL,
    \`read\` BOOLEAN NOT NULL DEFAULT false,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`notifications_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`notification_comments\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`notificationId\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`body\` TEXT NOT NULL,
    \`isAdminReply\` BOOLEAN NOT NULL DEFAULT false,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`notification_comments_notificationId_idx\`(\`notificationId\`),
    INDEX \`notification_comments_userId_idx\`(\`userId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`push_notifications\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`packageName\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`description\` VARCHAR(191) NOT NULL DEFAULT '',
    \`imageUrl\` TEXT NULL,
    \`html\` LONGTEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`push_notifications_userId_idx\`(\`userId\`),
    INDEX \`push_notifications_packageName_idx\`(\`packageName\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`push_devices\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`packageName\` VARCHAR(191) NOT NULL,
    \`deviceId\` VARCHAR(191) NOT NULL,
    \`model\` VARCHAR(191) NOT NULL DEFAULT '',
    \`lastSeen\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`push_devices_userId_idx\`(\`userId\`),
    UNIQUE INDEX \`push_devices_packageName_deviceId_key\`(\`packageName\`, \`deviceId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`push_deliveries\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`notificationId\` VARCHAR(191) NOT NULL,
    \`deviceId\` VARCHAR(191) NOT NULL,
    \`deliveredAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`push_deliveries_deviceId_idx\`(\`deviceId\`),
    UNIQUE INDEX \`push_deliveries_notificationId_deviceId_key\`(\`notificationId\`, \`deviceId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`plans\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`description\` TEXT NOT NULL DEFAULT (''),
    \`price\` INTEGER NOT NULL DEFAULT 0,
    \`priceYearly\` INTEGER NOT NULL DEFAULT 0,
    \`features\` TEXT NOT NULL,
    \`accent\` VARCHAR(191) NOT NULL DEFAULT 'violet',
    \`isPopular\` BOOLEAN NOT NULL DEFAULT false,
    \`isActive\` BOOLEAN NOT NULL DEFAULT true,
    \`sortOrder\` INTEGER NOT NULL DEFAULT 0,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`plans_name_key\`(\`name\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`listings\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`description\` TEXT NOT NULL DEFAULT (''),
    \`price\` INTEGER NOT NULL DEFAULT 0,
    \`category\` VARCHAR(191) NOT NULL DEFAULT 'General',
    \`tags\` TEXT NOT NULL DEFAULT (''),
    \`previewType\` VARCHAR(191) NOT NULL DEFAULT 'gradient',
    \`previewText\` TEXT NULL,
    \`previewSub\` TEXT NULL,
    \`status\` VARCHAR(191) NOT NULL DEFAULT 'active',
    \`salesCount\` INTEGER NOT NULL DEFAULT 0,
    \`views\` INTEGER NOT NULL DEFAULT 0,
    \`rating\` DOUBLE NOT NULL DEFAULT 0,
    \`ratingCount\` INTEGER NOT NULL DEFAULT 0,
    \`projectId\` VARCHAR(191) NOT NULL,
    \`sellerId\` VARCHAR(191) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    INDEX \`listings_sellerId_idx\`(\`sellerId\`),
    INDEX \`listings_status_idx\`(\`status\`),
    INDEX \`listings_category_idx\`(\`category\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`purchases\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`listingId\` VARCHAR(191) NOT NULL,
    \`buyerId\` VARCHAR(191) NOT NULL,
    \`sellerId\` VARCHAR(191) NOT NULL,
    \`projectId\` VARCHAR(191) NOT NULL,
    \`projectName\` VARCHAR(191) NOT NULL,
    \`originalPrice\` INTEGER NOT NULL,
    \`discount\` INTEGER NOT NULL DEFAULT 0,
    \`finalPrice\` INTEGER NOT NULL,
    \`couponCode\` TEXT NULL,
    \`couponId\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`purchases_buyerId_idx\`(\`buyerId\`),
    INDEX \`purchases_sellerId_idx\`(\`sellerId\`),
    INDEX \`purchases_listingId_idx\`(\`listingId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`coupons\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`code\` VARCHAR(191) NOT NULL,
    \`discountPercent\` INTEGER NOT NULL DEFAULT 10,
    \`maxUses\` INTEGER NOT NULL DEFAULT 0,
    \`usedCount\` INTEGER NOT NULL DEFAULT 0,
    \`expiresAt\` DATETIME(3) NULL,
    \`active\` BOOLEAN NOT NULL DEFAULT true,
    \`listingId\` VARCHAR(191) NULL,
    \`sellerId\` VARCHAR(191) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`coupons_sellerId_idx\`(\`sellerId\`),
    INDEX \`coupons_listingId_idx\`(\`listingId\`),
    INDEX \`coupons_code_idx\`(\`code\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

  `CREATE TABLE IF NOT EXISTS \`reviews\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`listingId\` VARCHAR(191) NOT NULL,
    \`userId\` VARCHAR(191) NOT NULL,
    \`rating\` INTEGER NOT NULL DEFAULT 5,
    \`comment\` TEXT NOT NULL DEFAULT (''),
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX \`reviews_listingId_idx\`(\`listingId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
]

export const FOREIGN_KEYS: Array<{ name: string; sql: string }> = [
  { name: 'sessions_userId_fkey', sql: 'ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'projects_userId_fkey', sql: 'ALTER TABLE `projects` ADD CONSTRAINT `projects_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'project_files_projectId_fkey', sql: 'ALTER TABLE `project_files` ADD CONSTRAINT `project_files_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'builds_userId_fkey', sql: 'ALTER TABLE `builds` ADD CONSTRAINT `builds_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'builds_projectId_fkey', sql: 'ALTER TABLE `builds` ADD CONSTRAINT `builds_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL ON UPDATE CASCADE' },
  { name: 'payments_userId_fkey', sql: 'ALTER TABLE `payments` ADD CONSTRAINT `payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'notifications_userId_fkey', sql: 'ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'notification_comments_notificationId_fkey', sql: 'ALTER TABLE `notification_comments` ADD CONSTRAINT `notification_comments_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'notification_comments_userId_fkey', sql: 'ALTER TABLE `notification_comments` ADD CONSTRAINT `notification_comments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'push_notifications_userId_fkey', sql: 'ALTER TABLE `push_notifications` ADD CONSTRAINT `push_notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'push_devices_userId_fkey', sql: 'ALTER TABLE `push_devices` ADD CONSTRAINT `push_devices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'push_deliveries_notificationId_fkey', sql: 'ALTER TABLE `push_deliveries` ADD CONSTRAINT `push_deliveries_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `push_notifications`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'push_deliveries_deviceId_fkey', sql: 'ALTER TABLE `push_deliveries` ADD CONSTRAINT `push_deliveries_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `push_devices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'listings_projectId_fkey', sql: 'ALTER TABLE `listings` ADD CONSTRAINT `listings_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'listings_sellerId_fkey', sql: 'ALTER TABLE `listings` ADD CONSTRAINT `listings_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'purchases_listingId_fkey', sql: 'ALTER TABLE `purchases` ADD CONSTRAINT `purchases_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'purchases_buyerId_fkey', sql: 'ALTER TABLE `purchases` ADD CONSTRAINT `purchases_buyerId_fkey` FOREIGN KEY (`buyerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'purchases_sellerId_fkey', sql: 'ALTER TABLE `purchases` ADD CONSTRAINT `purchases_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'coupons_listingId_fkey', sql: 'ALTER TABLE `coupons` ADD CONSTRAINT `coupons_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'coupons_sellerId_fkey', sql: 'ALTER TABLE `coupons` ADD CONSTRAINT `coupons_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
  { name: 'reviews_listingId_fkey', sql: 'ALTER TABLE `reviews` ADD CONSTRAINT `reviews_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE' },
]
