// Seeds the official app release: login as admin → upload download/Wevlo-v2.2.apk → verify download
// Usage: node scripts/seed-app-release.mjs [apkPath] [versionName] [versionCode] [notes]
import { readFile } from 'fs/promises'
import path from 'path'

const BASE = process.env.SITE_URL || 'http://localhost:3000'
const EMAIL = 'zarif@apkforge.test'
const PASS = 'secret123'

const apkPath = process.argv[2] || 'download/Wevlo-v2.2.apk'
const versionName = process.argv[3] || '2.2'
const versionCode = process.argv[4] || '2'
const notes =
  process.argv[5] ||
  '• Native Kotlin app — full WEVLO website experience\n• One-time login: stay signed in forever\n• Admin Panel with Dashboard & Engine tabs\n• Lab, Store, Code Editor & live Build Console'

async function main() {
  // 1. login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status} ${await loginRes.text()}`)
  const cookie = (loginRes.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ')
  console.log('✓ logged in as', EMAIL)

  // 2. upload apk
  const buf = await readFile(path.resolve(apkPath))
  const fd = new FormData()
  fd.append('apk', new Blob([buf], { type: 'application/vnd.android.package-archive' }), path.basename(apkPath))
  fd.append('versionName', versionName)
  fd.append('versionCode', String(versionCode))
  fd.append('notes', notes)
  const upRes = await fetch(`${BASE}/api/app`, {
    method: 'POST',
    headers: { cookie },
    body: fd,
  })
  const upData = await upRes.json()
  if (!upRes.ok) throw new Error(`upload failed: ${upRes.status} ${JSON.stringify(upData)}`)
  console.log('✓ published release:', JSON.stringify(upData.release))

  // 3. verify public info + download
  const info = await fetch(`${BASE}/api/app`).then((r) => r.json())
  console.log('✓ public info:', JSON.stringify(info))

  const dl = await fetch(`${BASE}/api/app/download`)
  const dlBuf = Buffer.from(await dl.arrayBuffer())
  const magic = dlBuf.subarray(0, 2).toString()
  console.log(`✓ download: HTTP ${dl.status}, ${dlBuf.length} bytes, disposition="${dl.headers.get('content-disposition')}", magic="${magic}"`)
  if (dl.status !== 200 || magic !== 'PK') throw new Error('download verification FAILED')
  if (dlBuf.length !== buf.length) throw new Error(`size mismatch: sent ${buf.length}, got ${dlBuf.length}`)
  console.log('✅ seed complete — download system is live')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
