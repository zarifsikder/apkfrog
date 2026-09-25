import JSZip from 'jszip'
import { readFile } from 'fs/promises'
import path from 'path'
import { mainActivityJava, themeXml, xmlEsc, decodeDataUrl, defaultIconBuffer, pushClientJava, pushReceiverJava, type BuildConfig } from './app-templates'

/**
 * Generates a COMPLETE Gradle Android project (zip) from a Build record so that
 * GitHub Actions can run `gradle assembleDebug` on it directly.
 *
 * Supported sources:
 *  - html (project files / uploaded zip / remote url) → WebView app
 *  - kotlin (uploaded zip) → raw Kotlin/Java sources wrapped in a generated Gradle
 *    project (androidx/material/compose deps auto-detected), or a full Android
 *    Studio project passed through as-is.
 */

export interface GradleBuildInput {
  id: string
  appName: string
  packageName: string
  versionName: string
  versionCode: number
  sourceType: string
  sourceMode: string
  websiteUrl?: string | null
  zipPath?: string | null
  config: string
  serverUrl?: string | null
  project?: { files: Array<{ path: string; content: string }> } | null
}

type Entry = { path: string; data: Buffer | string }

const AGP_VERSION = '8.5.2'
const KOTLIN_VERSION = '2.0.21'
const COMPOSE_BOM = '2024.06.00'

const JUNK = /(^|\/)(__MACOSX|\.git|\.github|\.gradle|\.idea|build|\.DS_Store)(\/|$)/i

// import prefix → gradle dependency (androidx / material / play)
const DEP_MAP: Array<[string, string]> = [
  ['androidx.appcompat', 'androidx.appcompat:appcompat:1.7.0'],
  ['androidx.core', 'androidx.core:core-ktx:1.13.1'],
  ['androidx.constraintlayout', 'androidx.constraintlayout:constraintlayout:2.1.4'],
  ['com.google.android.material', 'com.google.android.material:material:1.12.0'],
  ['androidx.recyclerview', 'androidx.recyclerview:recyclerview:1.3.2'],
  ['androidx.viewpager2', 'androidx.viewpager2:viewpager2:1.1.0'],
  ['androidx.cardview', 'androidx.cardview:cardview:1.0.0'],
  ['androidx.browser', 'androidx.browser:browser:1.8.0'],
  ['androidx.fragment', 'androidx.fragment:fragment-ktx:1.8.2'],
  ['androidx.activity', 'androidx.activity:activity-ktx:1.9.1'],
  ['androidx.lifecycle', 'androidx.lifecycle:lifecycle-runtime-ktx:2.8.4'],
  ['androidx.webkit', 'androidx.webkit:webkit:1.11.0'],
  ['androidx.annotation', 'androidx.annotation:annotation:1.8.0'],
  ['androidx.exifinterface', 'androidx.exifinterface:exifinterface:1.3.7'],
  ['androidx.gridlayout', 'androidx.gridlayout:gridlayout:1.0.0'],
  ['androidx.palette', 'androidx.palette:palette-ktx:1.0.0'],
  ['androidx.preference', 'androidx.preference:preference-ktx:1.2.1'],
  ['androidx.swiperefreshlayout', 'androidx.swiperefreshlayout:swiperefreshlayout:1.1.0'],
  ['androidx.drawerlayout', 'androidx.drawerlayout:drawerlayout:1.2.0'],
  ['androidx.slidingpanelayout', 'androidx.slidingpanelayout:slidingpanelayout:1.2.0'],
]

function safeRelPath(p: string): string {
  return p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\.+/g, '__')
}

function sanitizeGradleName(s: string): string {
  const n = s.replace(/[^A-Za-z0-9_]/g, '_')
  return /^[A-Za-z]/.test(n) ? n : 'A' + n
}

function detectPackage(src: string): string | null {
  const m = src.match(/^\s*package\s+([a-zA-Z][\w.]*)/m)
  return m ? m[1] : null
}

async function loadZipEntries(zipPath: string): Promise<Map<string, Buffer>> {
  const raw = await readFile(zipPath)
  const zip = await JSZip.loadAsync(raw)
  const out = new Map<string, Buffer>()
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir)
  // flatten a single top-level folder
  let prefix = ''
  const tops = new Set(names.map((n) => n.split('/')[0]))
  if (tops.size === 1 && !names.some((n) => !n.includes('/'))) {
    prefix = `${[...tops][0]}/`
  }
  for (const name of names) {
    if (JUNK.test(name)) continue
    const rel = safeRelPath(prefix && name.startsWith(prefix) ? name.slice(prefix.length) : name)
    if (!rel) continue
    out.set(rel, await zip.files[name].async('nodebuffer'))
  }
  return out
}

async function iconEntries(cfg: BuildConfig): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>()
  let src: Buffer | null = null
  if (cfg.icon) {
    const raw = decodeDataUrl(cfg.icon)
    if (raw) {
      try {
        const sharp = (await import('sharp')).default
        src = await sharp(raw).resize(512, 512, { fit: 'cover' }).png().toBuffer()
      } catch {
        src = null
      }
    }
  }
  if (!src) src = await defaultIconBuffer()
  const densities: Array<[string, number]> = [
    ['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192],
  ]
  const sharp = (await import('sharp')).default
  for (const [d, s] of densities) {
    out.set(`app/src/main/res/mipmap-${d}/ic_launcher.png`, await sharp(src).resize(s, s, { fit: 'cover' }).png().toBuffer())
  }
  return out
}

async function splashEntries(cfg: BuildConfig): Promise<Map<string, Buffer>> {
  const out = new Map<string, Buffer>()
  if (!cfg.splash) return out
  const raw = decodeDataUrl(cfg.splash)
  if (!raw) return out
  try {
    const sharp = (await import('sharp')).default
    const png = await sharp(raw).resize(1440, 2560, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()
    out.set(
      'app/src/main/res/drawable/wv_splash.xml',
      Buffer.from(
        `<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n  <item android:drawable="@color/wv_bg" />\n  <item><bitmap android:src="@drawable/wv_splash_img" android:gravity="center" /></item>\n</layer-list>\n`
      )
    )
    out.set('app/src/main/res/drawable/wv_splash_img.png', png)
  } catch {
    /* ignore broken splash */
  }
  return out
}

function gradleFiles(opts: {
  namespace: string
  appId: string
  versionName: string
  versionCode: number
  kotlin: boolean
  compose: boolean
  deps: string[]
  hasLibs: boolean
  aars: string[]
}): Map<string, string> {
  const { namespace, appId, versionName, versionCode, kotlin, compose, deps, hasLibs, aars } = opts
  const f = new Map<string, string>()

  const rootPlugins = [`    id 'com.android.application' version '${AGP_VERSION}' apply false`]
  if (kotlin) rootPlugins.push(`    id 'org.jetbrains.kotlin.android' version '${KOTLIN_VERSION}' apply false`)
  if (compose) rootPlugins.push(`    id 'org.jetbrains.kotlin.plugin.compose' version '${KOTLIN_VERSION}' apply false`)

  f.set(
    'build.gradle',
    `// Generated by ApkForge — real Gradle build runs on GitHub Actions\nplugins {\n${rootPlugins.join('\n')}\n}\n`
  )

  f.set(
    'settings.gradle',
    `pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\nrootProject.name = "${sanitizeGradleName(appId.split('.').pop() || 'ApkForgeApp')}"\ninclude ':app'\n`
  )

  f.set(
    'gradle.properties',
    `org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nandroid.nonTransitiveRClass=false\nkotlin.code.style=official\n`
  )

  const appPlugins = [`    id 'com.android.application'`]
  if (kotlin) appPlugins.push(`    id 'org.jetbrains.kotlin.android'`)
  if (compose) appPlugins.push(`    id 'org.jetbrains.kotlin.plugin.compose'`)

  const androidBlock = [
    `    namespace '${namespace}'`,
    `    compileSdk 34`,
    ``,
    `    defaultConfig {`,
    `        applicationId "${appId}"`,
    `        minSdk 21`,
    `        targetSdk 34`,
    `        versionCode ${versionCode}`,
    `        versionName "${versionName.replace(/"/g, '')}"`,
    `    }`,
    ``,
    `    buildTypes {`,
    `        release {`,
    `            minifyEnabled false`,
    `        }`,
    `    }`,
    ``,
    `    compileOptions {`,
    `        sourceCompatibility JavaVersion.VERSION_17`,
    `        targetCompatibility JavaVersion.VERSION_17`,
    `    }`,
  ]
  if (kotlin) androidBlock.push(`    kotlinOptions {\n        jvmTarget = '17'\n    }`)
  if (compose) androidBlock.push(`    buildFeatures {\n        compose true\n    }`)

  const depLines: string[] = []
  if (hasLibs) depLines.push(`    implementation fileTree(dir: 'libs', include: ['*.jar'])`)
  for (const aar of aars) depLines.push(`    implementation files('libs/${aar.replace(/'/g, '')}')`)
  depLines.push(...deps.map((d) => `    implementation '${d}'`))
  if (compose) {
    depLines.push(
      `    implementation platform('androidx.compose:compose-bom:${COMPOSE_BOM}')`,
      `    implementation 'androidx.compose.ui:ui'`,
      `    implementation 'androidx.compose.material3:material3'`,
      `    implementation 'androidx.compose.ui:ui-tooling-preview'`,
      `    implementation 'androidx.activity:activity-compose:1.9.1'`
    )
  }

  f.set(
    'app/build.gradle',
    `// Generated by ApkForge — app module\nplugins {\n${appPlugins.join('\n')}\n}\n\nandroid {\n${androidBlock.join('\n')}\n}\n\ndependencies {\n${depLines.join('\n') || '    // no dependencies needed'}\n}\n`
  )

  return f
}

function generatedManifest(opts: {
  permissions: string[]
  labelLiteral: string
  themeRef: string
  pushReceiver?: boolean
}): string {
  const { permissions, labelLiteral, themeRef, pushReceiver } = opts
  const receiver = pushReceiver
    ? `
    <receiver
        android:name=".PushReceiver"
        android:exported="false">
      <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
      </intent-filter>
    </receiver>`
    : ''
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

  ${permissions.map((p) => `<uses-permission android:name="${p}" />`).join('\n  ')}

  <application
      android:label="${labelLiteral}"
      android:icon="@mipmap/ic_launcher"
      android:theme="${themeRef}"
      android:usesCleartextTraffic="true"
      android:hardwareAccelerated="true"
      android:supportsRtl="true">
    <activity
        android:name=".MainActivity"
        android:exported="true"
        android:configChanges="orientation|screenSize|keyboardHidden|screenLayout|smallestScreenSize"
        android:windowSoftInputMode="adjustResize">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>${receiver}
  </application>
</manifest>
`
}

function findEntryHtml(entries: Map<string, Buffer | string>): string | null {
  const htmls = [...entries.keys()].filter((p) => /\.(html|htm)$/i.test(p))
  if (htmls.length === 0) return null
  const idx = htmls.find((p) => p.toLowerCase() === 'index.html' || p.toLowerCase().endsWith('/index.html'))
  return (idx || htmls.sort((a, b) => a.split('/').length - b.split('/').length)[0]) ?? null
}

export async function generateGradleProjectZip(
  build: GradleBuildInput
): Promise<{ zip: Buffer; notes: string[] }> {
  const notes: string[] = []
  const out = new Map<string, Entry>()
  let cfg: BuildConfig = {}
  try {
    cfg = JSON.parse(build.config || '{}')
  } catch {
    cfg = {}
  }

  const dark = Boolean(cfg.darkModeSupport)
  const statusBar = typeof cfg.statusBarColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(cfg.statusBarColor) ? cfg.statusBarColor : dark ? '#000000' : '#1d4ed8'
  const bg = dark ? '#121212' : '#ffffff'

  const permissions = ['android.permission.INTERNET']
  if (cfg.cameraAccess) permissions.push('android.permission.CAMERA')
  if (cfg.microphone) permissions.push('android.permission.RECORD_AUDIO')

  let compose = false
  const deps = new Set<string>()
  let hasLibs = false
  const aars: string[] = []

  // ------------------------------------------------------------------ KOTLIN ZIP
  if (build.sourceType === 'kotlin') {
    if (!build.zipPath) throw new Error('Kotlin/Java source ZIP is missing')
    const entries = await loadZipEntries(build.zipPath)
    notes.push(`[source] Kotlin/Java ZIP loaded (${entries.size} files)`)

    const isFullGradle = ['settings.gradle', 'settings.gradle.kts', 'app/build.gradle', 'app/build.gradle.kts'].some((p) =>
      entries.has(p)
    )

    if (isFullGradle) {
      // full Android Studio project — pass through untouched, runner builds it as-is
      for (const [p, data] of entries) out.set(p, { path: p, data })
      notes.push('[source] Full Android Studio (Gradle) project detected — building with the project\'s own Gradle files')
      const zip = await pack(out)
      return { zip, notes }
    }

    // ---- raw source layout → wrap into generated gradle project
    const prefixes = ['', 'app/src/main/', 'src/main/', 'main/']
    let prefix = prefixes.find((p) => entries.has(p + 'AndroidManifest.xml')) ?? null

    let manifestXml: string | null = null
    let manifestPkg: string | null = null
    if (prefix !== null) {
      manifestXml = entries.get(prefix + 'AndroidManifest.xml')!.toString('utf8')
      const pm = manifestXml.match(/package\s*=\s*"([^"]+)"/)
      if (pm && pm[1]) manifestPkg = pm[1]
      notes.push(`[manifest] project manifest found (package ${manifestPkg || build.packageName})`)
    } else {
      // no manifest — find MainActivity anywhere
      const mainEntry = [...entries.keys()].find((p) => /(^|\/)MainActivity\.(kt|java)$/.test(p))
      if (!mainEntry) throw new Error('No AndroidManifest.xml and no MainActivity found in the ZIP')
      const pkg = detectPackage(entries.get(mainEntry)!.toString('utf8')) || build.packageName
      manifestPkg = pkg
      notes.push(`[manifest] no manifest in ZIP — generated from ${path.basename(mainEntry)} (package ${pkg})`)
    }

    const namespace = manifestPkg || build.packageName
    const base = prefix === '' ? '' : prefix

    // classify entries
    const srcFiles: Array<{ rel: string; data: Buffer | string }> = []
    const javaDirFiles: Array<{ rel: string; data: Buffer | string }> = []
    let userHasLauncherIcon = false
    let userHasAppName = false

    for (const [full, data] of entries) {
      if (prefix !== null && full === prefix + 'AndroidManifest.xml') continue
      const rel = prefix !== null && full.startsWith(prefix) ? full.slice(prefix.length) : full
      if (/^res\//.test(rel)) {
        if (/ic_launcher/i.test(rel)) userHasLauncherIcon = true
        if (/^res\/values\/strings\.xml$/.test(rel) && /name="app_name"/.test(data.toString('utf8'))) userHasAppName = true
        out.set('app/src/main/' + rel, { path: 'app/src/main/' + rel, data })
      } else if (/^assets\//.test(rel)) {
        out.set('app/src/main/' + rel, { path: 'app/src/main/' + rel, data })
      } else if (/^(java|kotlin)\//.test(rel)) {
        javaDirFiles.push({ rel, data })
      } else if (/^libs\/[^/]+\.(jar|aar)$/i.test(rel)) {
        if (/\.aar$/i.test(rel)) aars.push(path.basename(rel))
        else hasLibs = true
        out.set('app/' + rel, { path: 'app/' + rel, data })
      } else if (/\.(kt|kts|java)$/i.test(rel)) {
        srcFiles.push({ rel, data })
      }
      // everything else (readme, gradle leftovers…) is ignored in raw mode
    }

    // loose sources → java/<package path>; java/kotlin dirs → keep structure
    let kotlinSource = false
    const allSources: Array<{ rel: string; data: Buffer | string }> = []
    for (const f of javaDirFiles) {
      const rel = f.rel.replace(/^(java|kotlin)\//, '')
      out.set('app/src/main/java/' + rel, { path: 'app/src/main/java/' + rel, data: f.data })
      allSources.push(f)
      if (/\.kt$/i.test(rel)) kotlinSource = true
    }
    for (const f of srcFiles) {
      const content = f.data.toString('utf8')
      const pkg = detectPackage(content) || namespace
      const dest = `app/src/main/java/${pkg.split('.').join('/')}/${path.basename(f.rel)}`
      out.set(dest, { path: dest, data: f.data })
      allSources.push(f)
      if (/\.kt$/i.test(f.rel)) kotlinSource = true
    }
    if (allSources.length === 0) throw new Error('No .kt or .java files found in the uploaded ZIP')
    notes.push(`[source] ${allSources.filter((f) => /\.kt$/i.test(f.rel)).length} Kotlin + ${allSources.filter((f) => /\.java$/i.test(f.rel)).length} Java files mapped into app/src/main/java`)

    // dependency detection
    for (const f of allSources) {
      const content = f.data.toString('utf8')
      const imports = content.match(/^\s*import\s+([\w.]+)/gm) || []
      for (const imp of imports) {
        const pkg = imp.replace(/^\s*import\s+/, '')
        if (pkg.startsWith('androidx.compose.')) compose = true
        for (const [prefixKey, dep] of DEP_MAP) {
          if (pkg.startsWith(prefixKey)) deps.add(dep)
        }
      }
      if (/\bsetContent\s*\{/.test(content) || /ComponentActivity|AbstractComposeView/.test(content)) compose = true
    }
    if (compose) notes.push('[deps] Jetpack Compose detected — compose toolchain added')
    if (deps.size) notes.push(`[deps] AndroidX/Material dependencies: ${[...deps].length} added automatically`)

    // manifest (user's, cleaned up) or generated
    if (manifestXml) {
      let cleaned = manifestXml
        .replace(/\s+package="[^"]*"/, '')
        .replace(/<uses-sdk[\s\S]*?\/>/g, '')
      // strip sourceMappingURL-style noise? none. ensure application has icon/label if missing
      if (!/<application[^>]*android:label=/.test(cleaned)) {
        cleaned = cleaned.replace(/<application/, `<application\n      android:label="${xmlEsc(build.appName)}"`)
      }
      if (!/<application[^>]*android:icon=/.test(cleaned)) {
        cleaned = cleaned.replace(/<application/, `<application\n      android:icon="@mipmap/ic_launcher"`)
      }
      out.set('app/src/main/AndroidManifest.xml', { path: 'app/src/main/AndroidManifest.xml', data: Buffer.from(cleaned) })
    } else {
      out.set(
        'app/src/main/AndroidManifest.xml',
        {
          path: 'app/src/main/AndroidManifest.xml',
          data: Buffer.from(
            generatedManifest({ permissions, labelLiteral: xmlEsc(build.appName), themeRef: '@style/Theme.ApkForge.Main' })
          ),
        }
      )
    }

    // generated resources — only what the user didn't provide
    const values = new Map<string, string>()
    if (!userHasAppName) {
      values.set('app_name', `  <string name="app_name">${xmlEsc(build.appName)}</string>`)
    }
    values.set('wv_bg', `  <color name="wv_bg">${bg}</color>`)
    values.set('wv_status_bar', `  <color name="wv_status_bar">${statusBar}</color>`)

    const splash = await splashEntries(cfg)
    const splashOk = splash.size > 0
    if (splashOk) for (const [p, buf] of splash) out.set(p, { path: p, data: buf })
    const splashRef = splashOk ? '@drawable/wv_splash' : '@color/wv_bg'

    out.set(
      'app/src/main/res/values/wv_themes.xml',
      {
        path: 'app/src/main/res/values/wv_themes.xml',
        data: Buffer.from(themeXml(dark, Boolean(cfg.fullscreen), splashRef, statusBar)),
      }
    )
    out.set(
      'app/src/main/res/values/wv_values.xml',
      {
        path: 'app/src/main/res/values/wv_values.xml',
        data: Buffer.from(`<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${[...values.values()].join('\n')}\n</resources>\n`),
      }
    )
    if (!userHasLauncherIcon) {
      for (const [p, buf] of await iconEntries(cfg)) out.set(p, { path: p, data: buf })
    }

    // gradle files
    const gf = gradleFiles({
      namespace,
      appId: build.packageName,
      versionName: build.versionName,
      versionCode: build.versionCode,
      kotlin: kotlinSource || compose,
      compose,
      deps: [...deps],
      hasLibs,
      aars,
    })
    for (const [p, content] of gf) out.set(p, { path: p, data: Buffer.from(content) })

    notes.push(`[gradle] generated Gradle project (AGP ${AGP_VERSION}, Gradle wrapperless build, Kotlin ${KOTLIN_VERSION})`)
  } else {
    // ------------------------------------------------------------------ HTML / WEBVIEW
    const www = new Map<string, Buffer | string>()
    let startUrl = ''
    if (build.sourceMode === 'url' && build.websiteUrl) {
      startUrl = build.websiteUrl
      notes.push(`[source] remote website → ${build.websiteUrl}`)
    } else {
      if (build.sourceMode === 'zip' && build.zipPath) {
        const entries = await loadZipEntries(build.zipPath)
        for (const [p, data] of entries) www.set(p, data)
        notes.push(`[source] website ZIP (${entries.size} files)`)
      } else if (build.project?.files?.length) {
        for (const f of build.project.files) www.set(safeRelPath(f.path), f.content)
        notes.push(`[source] ${build.project.files.length} project files from editor`)
      } else {
        throw new Error('No website source selected')
      }
      if (cfg.customCss && String(cfg.customCss).trim()) {
        www.set('wevlo-custom.css', String(cfg.customCss))
        const entryRel = findEntryHtml(www)
        if (entryRel) {
          let html = www.get(entryRel)!.toString()
          if (!html.includes('wevlo-custom.css')) {
            html = html.replace(/<\/head>/i, '  <link rel="stylesheet" href="wevlo-custom.css">\n</head>')
            www.set(entryRel, html)
          }
        }
      }
      const entry = findEntryHtml(www)
      if (!entry) throw new Error('No index.html (or any .html file) found in the website source')
      const encoded = entry.split('/').map(encodeURIComponent).join('/')
      startUrl = `file:///android_asset/www/${encoded}`
      notes.push(`[source] entry page → ${entry}`)
    }

    for (const [p, data] of www) {
      const dest = `app/src/main/assets/www/${p}`
      out.set(dest, { path: dest, data })
    }

    // ─── Push Notifications (Website → APK): embed poll client unless disabled ───
    const pushEnabled = cfg.pushNotifications !== false
    const pushServerUrl = String(build.serverUrl || '').trim().replace(/\/+$/, '')
    const pushOk = pushEnabled && /^https?:\/\/.+/i.test(pushServerUrl)
    if (pushOk) {
      const pushPermissions = [
        ...permissions,
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
      ]
      out.set(
        'app/src/main/AndroidManifest.xml',
        {
          path: 'app/src/main/AndroidManifest.xml',
          data: Buffer.from(generatedManifest({ permissions: pushPermissions, labelLiteral: xmlEsc(build.appName), themeRef: '@style/Theme.ApkForge.Main', pushReceiver: true })),
        }
      )
    } else {
      out.set(
        'app/src/main/AndroidManifest.xml',
        {
          path: 'app/src/main/AndroidManifest.xml',
          data: Buffer.from(generatedManifest({ permissions, labelLiteral: xmlEsc(build.appName), themeRef: '@style/Theme.ApkForge.Main', pushReceiver: false })),
        }
      )
    }
    const mainSrc = mainActivityJava(build.packageName, startUrl, cfg, dark ? '#121212' : '#ffffff', pushOk ? pushServerUrl : null)
    const javaDir = `app/src/main/java/${build.packageName.split('.').join('/')}`
    out.set(`${javaDir}/MainActivity.java`, {
      path: `${javaDir}/MainActivity.java`,
      data: Buffer.from(mainSrc),
    })
    if (pushOk) {
      out.set(`${javaDir}/PushClient.java`, {
        path: `${javaDir}/PushClient.java`,
        data: Buffer.from(pushClientJava(build.packageName, pushServerUrl)),
      })
      out.set(`${javaDir}/PushReceiver.java`, {
        path: `${javaDir}/PushReceiver.java`,
        data: Buffer.from(pushReceiverJava(build.packageName)),
      })
      notes.push(`[push] Push Notifications embedded (server ${pushServerUrl})`)
    }

    // shared generated resources
    const splash = await splashEntries(cfg)
    const splashOk = splash.size > 0
    if (splashOk) for (const [p, buf] of splash) out.set(p, { path: p, data: buf })
    const splashRef = splashOk ? '@drawable/wv_splash' : '@color/wv_bg'

    out.set(
      'app/src/main/res/values/wv_themes.xml',
      { path: 'app/src/main/res/values/wv_themes.xml', data: Buffer.from(themeXml(dark, Boolean(cfg.fullscreen), splashRef, statusBar)) }
    )
    out.set(
      'app/src/main/res/values/wv_values.xml',
      {
        path: 'app/src/main/res/values/wv_values.xml',
        data: Buffer.from(
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <color name="wv_bg">${dark ? '#121212' : '#ffffff'}</color>\n  <color name="wv_status_bar">${statusBar}</color>\n</resources>\n`
        ),
      }
    )
    for (const [p, buf] of await iconEntries(cfg)) out.set(p, { path: p, data: buf })

    const gf = gradleFiles({
      namespace: build.packageName,
      appId: build.packageName,
      versionName: build.versionName,
      versionCode: build.versionCode,
      kotlin: false,
      compose: false,
      deps: [],
      hasLibs: false,
      aars: [],
    })
    for (const [p, content] of gf) out.set(p, { path: p, data: Buffer.from(content) })
    notes.push('[gradle] generated WebView Gradle project (pure framework, no external deps)')
  }

  const zip = await pack(out)
  return { zip, notes }
}

async function pack(out: Map<string, Entry>): Promise<Buffer> {
  const zip = new JSZip()
  for (const [, e] of out) {
    zip.file(e.path, e.data)
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
