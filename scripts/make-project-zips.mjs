/**
 * Task 18/19 — builds THREE deliverable zips:
 *   1. download/ApkForge-Website.zip        → the Next.js main website (deployable source)
 *   2. download/ApkForge-App-Project.zip    → the standalone Android Studio project (Kotlin app)
 *   3. download/ApkForge-Full-Project.zip   → everything (site + app + live db + keystore)
 * All zips use a top-level wrapper folder so they extract cleanly.
 */
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'

const ROOT = '/home/z/my-project'
const DL = path.join(ROOT, 'download')
const APP_SRC = path.join(DL, 'wevlo-native-app')
const OUT_WEBSITE = path.join(DL, 'ApkForge-Website.zip')
const OUT_APP = path.join(DL, 'ApkForge-App-Project.zip')
const OUT_FULL = path.join(DL, 'ApkForge-Full-Project.zip')

function walkFiles(dir, base = dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walkFiles(full, base))
    else out.push({ rel: path.relative(base, full).split(path.sep).join('/'), content: fs.readFileSync(full) })
  }
  return out
}

const kb = (n) => (n / 1024).toFixed(0) + ' KB'

/* ============================================================
 * 1. MAIN WEBSITE ZIP — ApkForge-Website/
 * ============================================================ */
const website = new JSZip()
const W = 'ApkForge-Website'

// whole source folders (prisma/sqlite-client + prisma/mysql-client are generated
// artifacts — excluded; regenerate: bun run db:sqlite:generate / bun run db:generate)
const DIR_EXCLUDE = (rel) => rel.startsWith('mysql-client/') || rel.startsWith('sqlite-client/')
for (const dir of ['src', 'public', 'prisma']) {
  for (const f of walkFiles(path.join(ROOT, dir))) {
    if (!DIR_EXCLUDE(f.rel)) website.file(`${W}/${dir}/${f.rel}`, f.content)
  }
}

// operational scripts only (code files — no shots/, testproj/, artifacts, local-dev checks)
const SCRIPT_EXCLUDE = new Set([
  'rebrand-marks.py', // one-off migration tool, no longer needed
  'check-kotlin.sh', // dev-machine pre-flight (needs local SDK) — project only
  'smoke-test-apk.sh', // dev-machine APK verification — project only
  'check-admin-api.mjs',
  'check-app-state.mjs',
  'check-deployed-lab.mjs',
  'test-gradle-project.ts',
  'mysql-default-test.mjs', // one-off live-switch verification
  'e2e-mysql-switch.sh', // dev-machine live-switch verification (localhost)
  'scan-db-brand.mjs', // one-off live-DB brand audit (dev machine)
  'scan-db-brand-content.mjs', // one-off live-DB content audit (dev machine)
  'rebrand-referral-codes.mjs', // one-off DB rebrand op (dev machine)
  'migrate-admin-email.mjs', // one-off DB op — contains old pre-rebrand email
])
for (const name of fs.readdirSync(path.join(ROOT, 'scripts'))) {
  if (!/\.(mjs|py|sh|ts)$/.test(name) || SCRIPT_EXCLUDE.has(name)) continue
  website.file(`${W}/scripts/${name}`, fs.readFileSync(path.join(ROOT, 'scripts', name)))
}

// root config files
for (const name of ['package.json', 'bun.lock', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'tailwind.config.ts', 'components.json', 'eslint.config.mjs', 'next-env.d.ts', '.env.mysql.example']) {
  website.file(`${W}/${name}`, fs.readFileSync(path.join(ROOT, name)))
}

// portable .env — MySQL is the only supported database; fill in real values
website.file(`${W}/.env`, 'DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE_NAME?connection_limit=6&pool_timeout=30&connect_timeout=15"\n')

// APK signing keystore — REQUIRED to keep the same signature as published releases
for (const f of walkFiles(path.join(ROOT, 'db', 'keystore'))) {
  website.file(`${W}/db/keystore/${f.rel}`, f.content)
}

website.file(`${W}/README.md`, `# ApkForge — Main Website

Next.js 16 full-stack platform: online APK builder (Kotlin/HTML projects,
cloud build engine via GitHub Actions, store, wallet with AmarPayment auto
payment gateway, realtime events, admin panel with user management).

## Requirements

- bun (recommended) or Node.js 20+
- **MySQL 5.7+ / MariaDB 10.2+** — the only supported database

## Database setup (MySQL)

1. Create a database:
   \`CREATE DATABASE apkforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\`
2. Import **ApkForge-MySQL-Database.sql** (ships next to this zip) into it —
   phpMyAdmin → Import, or
   \`mysql -u USER -p apkforge < ApkForge-MySQL-Database.sql\`.
   (No mysql CLI? \`bun scripts/mysql-ops.mjs import\` does the same.)
3. Edit \`.env\` (shipped) and set your real credentials:
   \`DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/apkforge"\`
4. Install & run:

\`\`\`bash
bun install                # or: npm install
bun run db:generate        # prisma generate (MySQL client)
bun run dev                # development on :3000
\`\`\`

Production:

\`\`\`bash
bun run build
bun run start
\`\`\`

The LIVE database (users, projects, payments, app releases, GitHub token,
payment keys) is NOT part of this zip — it lives in your MySQL server.
**ApkForge-Full-Project.zip** contains a legacy SQLite copy (\`db/custom.db\`)
of the pre-MySQL data plus the real \`.env\` of the original machine.

## Build engine — GitHub Actions only

The heavy local Android toolchain has been REMOVED from this project. Every
APK (user builds and the official app) is built on GitHub Actions:

1. Admin Panel → **Engine** → paste a GitHub Personal Access Token
   (classic: repo + workflow scopes), or a fine-grained token with
   Contents/Actions/Administration read+write.
2. Set the **Public Site URL** (runners download your source zip from it).
3. "Setup repo" creates/repairs the build repo + workflow automatically.

If the engine is not configured, \`POST /api/builds\` answers 503 with a
clear message — no build row is created.

## APK signing keystore (important)

\`db/keystore/wevlo-release.jks\` IS included on purpose. The build workflow
signs every APK with it. Keep it identical to the published releases —
if you lose it, users must uninstall before updating
(applicationId \`com.wevlo.app\`, cert CN=Wevlo).

## Payment gateway (AmarPayment — auto payment)

Admin Panel → **Pay** tab → PAYMENT URL + API KEY (stored server-side in the
Setting table, masked in the UI). Flow: Wallet → gateway checkout →
\`/api/payments/callback\` webhook re-verifies server-to-server → wallet
credited automatically. No admin review needed.

## Official Android app deployment

\`scripts/wevlo-app-deploy.mjs\` uploads the native app sources (from
\`download/wevlo-native-app\`), registers them as a platform project and
triggers the build (via GitHub Actions — configure the Engine first):

\`\`\`bash
WEVLO_BASE=https://your-site bun run scripts/wevlo-app-deploy.mjs
\`\`\`

Version policy: versionName stays **"2.5"**, versionCode must increase
(current published build: code 7).

## Admin login (as shipped)

- \`zarif@apkforge.test\` / \`secret123\`
`)

/* ============================================================
 * 2. APP PROJECT ZIP — ApkForge-App-Project/
 *    (standalone Android Studio project — mirrors wevlo-app-deploy.mjs)
 * ============================================================ */
const app = new JSZip()
const A = 'ApkForge-App-Project'

app.file(`${A}/settings.gradle`, `pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\nrootProject.name = "ApkForge"\ninclude ':app'\n`)
app.file(`${A}/build.gradle`, `// ApkForge — official native Android app (website replica)\nplugins {\n    id 'com.android.application' version '8.5.2' apply false\n    id 'org.jetbrains.kotlin.android' version '2.0.21' apply false\n}\n`)
app.file(`${A}/gradle.properties`, `org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.nonTransitiveRClass=false\nkotlin.code.style=official\n`)
app.file(`${A}/app/build.gradle`, `plugins {\n    id 'com.android.application'\n    id 'org.jetbrains.kotlin.android'\n}\n\nandroid {\n    namespace 'com.wevlo.app'\n    compileSdk 34\n\n    defaultConfig {\n        applicationId "com.wevlo.app"\n        minSdk 21\n        targetSdk 34\n        versionCode 7\n        versionName "2.5"\n    }\n\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }\n    kotlinOptions {\n        jvmTarget = '17'\n    }\n}\n\ndependencies {\n    // framework-only — no external dependencies\n}\n`)

const main_ = `${A}/app/src/main`
const appSources = walkFiles(APP_SRC)
for (const f of appSources) {
  if (f.rel === 'AndroidManifest.xml') {
    app.file(`${main_}/AndroidManifest.xml`, f.content.toString().replace(/\s+package="[^"]*"/, ''))
  } else if (f.rel.startsWith('kotlin/')) {
    app.file(`${main_}/java/` + f.rel.slice('kotlin/'.length), f.content)
  } else {
    app.file(`${main_}/` + f.rel, f.content)
  }
}

app.file(`${A}/README.md`, `# ApkForge — Native Android App

Native Kotlin replica of the ApkForge web platform (login, dashboard, store,
lab, code editor, build console, APK download, wallet + payment, admin panel
with user management). Persistent login is built in — the session cookie and
credentials are stored on-device and the app silently re-authenticates, so
users log in only once.

## Server connection

The website URL is HARDCODED in the app
(\`AuthStore.kt → SERVER_URL = "https://p19yb76a1vy1-d.space-z.ai"\`).
Users never enter a server URL anywhere — everything works out of the box.
To point the app at a different site, change that one constant and rebuild.

## Admin Panel

The More drawer shows an "Admin Panel" entry for admin accounts
(role ADMIN or the platform admin email), with the same control center
the website shows: Dashboard, Users (user management), Engine (GitHub
build settings) and App (publish/unpublish official APK releases) + Pay.

## Note

There is no "Download App" entry inside the app itself — the running app
IS the official app. New users download the APK from the website's
Download App system (Home banner / auth page pill / Admin-published
release at /api/app/download).

## Build

Open in Android Studio (AGP 8.5.2, Kotlin 2.0.21) and run.
\`\`\`bash
gradle assembleDebug
\`\`\`

## Identity (do not change casually)

- applicationId \`com.wevlo.app\` — kept stable so every published release
  updates in place over older versions.
- versionName **"2.5"**, versionCode **7** (must increase on every release).
- Signed with \`db/keystore/wevlo-release.jks\` from the website project.

The same sources are also registered as the "ApkForge Official App" project
on the ApkForge platform (admin account) and build there through the
platform engine.
`)

/* ============================================================
 * 3. FULL PROJECT ZIP — ApkForge-Full-Project/
 *    everything: website source + app source + runtime db + keystore + uploads
 * ============================================================ */
const full = new JSZip()
const F = 'ApkForge-Full-Project'

// whole project dirs (runtime data included — this is the complete backup)
for (const dir of ['src', 'public', 'prisma', 'scripts', 'tests', 'examples']) {
  const abs = path.join(ROOT, dir)
  if (!fs.existsSync(abs)) continue
  for (const f of walkFiles(abs)) {
    if (dir === 'prisma' && DIR_EXCLUDE(f.rel)) continue // generated mysql client
    full.file(`${F}/${dir}/${f.rel}`, f.content)
  }
}
// native app sources (kept under download/ exactly like the live layout)
for (const f of walkFiles(APP_SRC)) full.file(`${F}/download/wevlo-native-app/${f.rel}`, f.content)
// runtime db: live database + built APKs + releases + uploads + keystore + assets
for (const name of fs.readdirSync(path.join(ROOT, 'db'))) {
  const abs = path.join(ROOT, 'db', name)
  const st = fs.statSync(abs)
  if (st.isFile()) full.file(`${F}/db/${name}`, fs.readFileSync(abs))
  else for (const f of walkFiles(abs)) full.file(`${F}/db/${name}/${f.rel}`, f.content)
}
// root files (real .env — this zip mirrors the live machine)
for (const name of ['package.json', 'bun.lock', 'tsconfig.json', 'next.config.ts', 'postcss.config.mjs', 'tailwind.config.ts', 'components.json', 'eslint.config.mjs', 'next-env.d.ts', '.env', '.env.mysql.example', 'worklog.md']) {
  const p = path.join(ROOT, name)
  if (fs.existsSync(p)) full.file(`${F}/${name}`, fs.readFileSync(p))
}
full.file(`${F}/README.md`, `# ApkForge — Full Project (everything in one box)

Contains:
- **Main website** source (src/, public/, prisma/, config files, scripts/)
  — live database is **MySQL** (prisma/schema.prisma, provider mysql)
- **Native Android app** source (download/wevlo-native-app/)
- **Real \`.env\`** of the live machine (MySQL credentials included — keep private)
- **Legacy data backup** (db/custom.db — the pre-MySQL SQLite database with
  users, projects, builds, payments, settings; kept for reference only)
- db/apks built APKs; db/app-releases published releases; db/uploads;
  db/keystore signing key (wevlo-release.jks)
- prisma/schema.sqlite.prisma + scripts/migrate-sqlite-to-mysql.mjs — the
  old SQLite→MySQL path (already run; kept so it can be repeated)
- download/ApkForge-MySQL-Database.sql — full MySQL DDL (10 tables)

Run it: import the SQL into your MySQL → edit \`.env\` DATABASE_URL →
\`bun install\` → \`bun run db:generate\` → \`bun run dev\`.

The separate smaller packages (website-only, app-only, APK, MySQL SQL) live
next to this zip in the download folder.
`)

/* ============================================================
 * Write all
 * ============================================================ */
const wBuf = await website.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
fs.writeFileSync(OUT_WEBSITE, wBuf)
console.log('✓', OUT_WEBSITE, kb(wBuf.length))

const aBuf = await app.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
fs.writeFileSync(OUT_APP, aBuf)
console.log('✓', OUT_APP, kb(aBuf.length))

const fBuf = await full.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
fs.writeFileSync(OUT_FULL, fBuf)
console.log('✓', OUT_FULL, kb(fBuf.length))
