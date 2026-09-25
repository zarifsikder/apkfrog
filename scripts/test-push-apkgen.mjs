// Verify the generated Gradle project embeds the push client correctly
import { generateGradleProjectZip } from '../src/lib/gradle-project.ts'
import JSZip from 'jszip'
import { writeFile } from 'fs/promises'

const build = {
  id: 'test123',
  appName: 'My Demo App',
  packageName: 'com.apkforge.demopush',
  versionName: '1.0',
  versionCode: 1,
  sourceType: 'html',
  sourceMode: 'project',
  config: JSON.stringify({ pushNotifications: true }),
  serverUrl: 'https://apkforge.example.com/',
  project: { files: [{ path: 'index.html', content: '<html><body><h1>Hello</h1></body></html>' }] },
}

const { zip, notes } = await generateGradleProjectZip(build)
await writeFile('/tmp/push-test.apkproj.zip', zip)
const z = await JSZip.loadAsync(zip)
const names = Object.keys(z.files)

const checks = []
const has = (p) => names.some((n) => n.endsWith(p))

checks.push(['PushClient.java generated', has('PushClient.java')])
checks.push(['PushReceiver.java generated', has('PushReceiver.java')])
checks.push(['MainActivity.java generated', has('MainActivity.java')])
checks.push(['www assets packaged', has('assets/www/index.html')])

const manifest = await z.file('app/src/main/AndroidManifest.xml').async('string')
checks.push(['manifest: POST_NOTIFICATIONS', manifest.includes('android.permission.POST_NOTIFICATIONS')])
checks.push(['manifest: VIBRATE', manifest.includes('android.permission.VIBRATE')])
checks.push(['manifest: RECEIVE_BOOT_COMPLETED', manifest.includes('android.permission.RECEIVE_BOOT_COMPLETED')])
checks.push(['manifest: PushReceiver declared', manifest.includes('.PushReceiver')])

const main = await z.file('app/src/main/java/com/apkforge/demopush/MainActivity.java').async('string')
checks.push(['MainActivity: PushClient.init', main.includes('PushClient.init(this, webView, "https://apkforge.example.com", "com.apkforge.demopush")')])
checks.push(['MainActivity: onResume/onPause hooks', main.includes('PushClient.setForeground(true)') && main.includes('PushClient.setForeground(false)')])
checks.push(['MainActivity: onDestroy cleanup', main.includes('PushClient.onActivityDestroyed()')])

const client = await z.file('app/src/main/java/com/apkforge/demopush/PushClient.java').async('string')
checks.push(['PushClient: package correct', client.startsWith('package com.apkforge.demopush;')])
checks.push(['PushClient: poll endpoint', client.includes('/api/push/poll')])
checks.push(['PushClient: register endpoint', client.includes('/api/push/device')])
checks.push(['PushClient: HTML overlay injection', client.includes('af-push-overlay')])
checks.push(['PushClient: BigPicture style', client.includes('BigPictureStyle')])
checks.push(['PushClient: no template leftovers', !client.includes('undefined') && !client.includes('${')])

// push disabled case
const buildOff = { ...build, config: JSON.stringify({ pushNotifications: false }) }
const { zip: zipOff } = await generateGradleProjectZip(buildOff)
const zOff = await JSZip.loadAsync(zipOff)
const namesOff = Object.keys(zOff.files)
const manifestOff = await zOff.file('app/src/main/AndroidManifest.xml').async('string')
const mainOff = await zOff.file('app/src/main/java/com/apkforge/demopush/MainActivity.java').async('string')
checks.push(['disabled: no PushClient.java', !namesOff.some((n) => n.endsWith('PushClient.java'))])
checks.push(['disabled: no PushReceiver in manifest', !manifestOff.includes('.PushReceiver')])
checks.push(['disabled: no init in MainActivity', !mainOff.includes('PushClient.init')])

// no serverUrl case (e.g. origin not configured)
const buildNoUrl = { ...build, serverUrl: null }
const { zip: zipNoUrl } = await generateGradleProjectZip(buildNoUrl)
const zNoUrl = await JSZip.loadAsync(zipNoUrl)
const namesNoUrl = Object.keys(zNoUrl.files)
checks.push(['no serverUrl: push skipped', !namesNoUrl.some((n) => n.endsWith('PushClient.java'))])

console.log(notes.join('\n'))
console.log('\n=== CHECKS ===')
let failed = 0
for (const [label, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) failed++
}
console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECKS FAILED`)
process.exit(failed === 0 ? 0 : 1)
