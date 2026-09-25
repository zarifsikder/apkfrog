/**
 * Wevlo Native App deployer (Task 10)
 * 1. Logs in as the Admin account
 * 2. Creates the "Wevlo Official App" project (type kotlin) on the platform
 * 3. Uploads every source file of the native Android app
 * 4. Zips the same sources and triggers a REAL build through the platform engine
 * 5. Polls the build console; on success downloads the signed APK
 * 6. Also packages a standalone Android Studio project zip
 */
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'

const BASE = process.env.WEVLO_BASE || 'http://localhost:3000'
const APP_DIR = '/home/z/my-project/download/wevlo-native-app'
const OUT_APK = '/home/z/my-project/download/ApkForge-v2.5.apk'
const OUT_STUDIO = '/home/z/my-project/download/wevlo-native-app-source.zip'
const PROJECT_NAME = 'ApkForge Official App'
const VERSION_NAME = '2.5'
const VERSION_CODE = 7

let cookie = ''

async function api(method, p, body, rawRes = false) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  for (const c of setCookies) if (c.startsWith('wv_session=')) cookie = c.split(';')[0]
  const text = res.ok && rawRes ? null : await res.text()
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status}: ${text.slice(0, 400)}`)
  if (rawRes) return Buffer.from(await res.arrayBuffer())
  return text ? JSON.parse(text) : {}
}

function walk(dir, base = dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(full, base))
    else out.push({ rel: path.relative(base, full).split(path.sep).join('/'), content: fs.readFileSync(full, 'utf8') })
  }
  return out
}

async function main() {
  console.log('→ logging in as admin…')
  const me = await api('POST', '/api/auth/login', { email: 'zarif@apkforge.test', password: 'secret123' })
  console.log('  ✓ logged in:', me.user.email)

  console.log('→ creating project…')
  const projects = (await api('GET', '/api/projects')).projects
  const existing = projects.find((p) => p.name === PROJECT_NAME)
  if (existing) {
    console.log('  removing previous run…')
    await api('DELETE', `/api/projects/${existing.id}`)
  }
  // keep projects list order stable: delete older duplicates with same name
  let proj = (await api('POST', '/api/projects', { name: PROJECT_NAME, type: 'kotlin' })).project
  console.log('  ✓ project id:', proj.id)

  for (const f of proj.files || []) await api('DELETE', `/api/files/${f.id}`)

  const files = walk(APP_DIR)
  console.log(`→ uploading ${files.length} source files…`)
  for (const f of files) {
    await api('POST', `/api/projects/${proj.id}/files`, { path: f.rel, content: f.content })
  }
  console.log('  ✓ uploaded')

  console.log('→ packing source zip…')
  const zip = new JSZip()
  for (const f of files) zip.file(f.rel, f.content)
  const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } })
  const b64 = 'data:application/zip;base64,' + zipBuf.toString('base64')
  console.log(`  ✓ ${(zipBuf.length / 1024).toFixed(0)} KB`)

  console.log('→ starting REAL build…')
  const build = (
    await api('POST', '/api/builds', {
      appName: 'ApkForge',
      packageName: 'com.wevlo.app',
      versionName: VERSION_NAME,
      versionCode: VERSION_CODE,
      sourceType: 'kotlin',
      sourceMode: 'zip',
      zipBase64: b64,
      config: {},
    })
  ).build
  console.log('  ✓ build id:', build.id, '| status:', build.status)

  const deadline = Date.now() + 300_000
  let status = build.status
  let last = ''
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000))
    const b = (await api('GET', `/api/builds/${build.id}`)).build
    status = b.status
    const line = `${b.status} ${b.progress}% ${b.currentStep}`
    if (line !== last) { console.log('  ' + line); last = line }
    if (status === 'success' || status === 'failed' || status === 'canceled') {
      if (status !== 'success') {
        console.error('BUILD FAILED:\n' + (b.logs || '').split('\n').slice(-25).join('\n'))
        process.exit(1)
      }
      console.log('  ✓ APK ready:', b.apkSize)
      break
    }
  }
  if (status !== 'success') { console.error('timeout'); process.exit(1) }

  console.log('→ downloading APK…')
  const apk = await api('GET', `/api/builds/${build.id}/download`, null, true)
  fs.writeFileSync(OUT_APK, apk)
  console.log('  ✓ saved', OUT_APK, `(${(apk.length / 1024).toFixed(0)} KB)`)

  console.log('→ packaging standalone Android Studio project…')
  const studio = new JSZip()
  const main_ = 'app/src/main'
  studio.file('settings.gradle', `pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\nrootProject.name = "ApkForge"\ninclude ':app'\n`)
  studio.file('build.gradle', `// Wevlo — official native Android app (website replica)\nplugins {\n    id 'com.android.application' version '8.5.2' apply false\n    id 'org.jetbrains.kotlin.android' version '2.0.21' apply false\n}\n`)
  studio.file('gradle.properties', `org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.nonTransitiveRClass=false\nkotlin.code.style=official\n`)
  studio.file('app/build.gradle', `plugins {\n    id 'com.android.application'\n    id 'org.jetbrains.kotlin.android'\n}\n\nandroid {\n    namespace 'com.wevlo.app'\n    compileSdk 34\n\n    defaultConfig {\n        applicationId "com.wevlo.app"\n        minSdk 21\n        targetSdk 34\n        versionCode 7\n        versionName "2.5"\n    }\n\n    buildTypes {\n        release {\n            minifyEnabled false\n        }\n    }\n\n    compileOptions {\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }\n    kotlinOptions {\n        jvmTarget = '17'\n    }\n}\n\ndependencies {\n    // framework-only — no external dependencies\n}\n`)
  const manifest = files.find((f) => f.rel === 'AndroidManifest.xml')
  studio.file(`${main_}/AndroidManifest.xml`, manifest.content.replace(/\s+package="[^"]*"/, ''))
  for (const f of files) {
    if (f.rel.startsWith('kotlin/')) {
      studio.file(`${main_}/java/` + f.rel.slice('kotlin/'.length), f.content)
    } else if (f.rel.startsWith('res/')) {
      studio.file(`${main_}/` + f.rel, f.content)
    }
  }
  studio.file('README.md', `# ApkForge — Native Android App

Native Kotlin replica of the Wevlo web platform (login, dashboard, store, lab,
code editor, build console, APK download, admin panel). Persistent login is
built in — the session cookie and credentials are stored on-device and the app
silently re-authenticates, so users log in only once.

## Server connection

The website URL is HARDCODED in the app
(\`AuthStore.kt → SERVER_URL = "https://p19yb76a1vy1-d.space-z.ai"\`).
Users never enter a server URL anywhere — everything works out of the box.
To point the app at a different site, change that one constant and rebuild.

## Admin Panel

The More drawer shows an "Admin Panel" entry for admin accounts
(role ADMIN or the platform admin email), with a Dashboard tab (platform
stats + recent builds), an Engine tab (GitHub build settings) and an App
tab (publish/unpublish official APK releases) — the same control center
the website shows.

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

The same sources are also registered as the "ApkForge Official App" project on the
Wevlo platform (Admin account) and build there through the platform engine.
`)
  const studioBuf = await studio.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  fs.writeFileSync(OUT_STUDIO, studioBuf)
  console.log('  ✓ saved', OUT_STUDIO, `(${(studioBuf.length / 1024).toFixed(0)} KB)`)

  console.log('\nDONE ✓ — project on platform:', proj.id)
}

main().catch((e) => { console.error(e); process.exit(1) })
