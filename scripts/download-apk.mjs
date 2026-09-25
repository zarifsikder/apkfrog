/** Re-download the APK for an existing successful build (binary-safe). */
import fs from 'fs'

const BASE = 'http://localhost:3000'
const BUILD_ID = process.argv[2]
const OUT = '/home/z/my-project/download/Wevlo-v2.1.apk'

let cookie = ''
const login = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'zarif@apkforge.test', password: 'secret123' }),
})
for (const c of login.headers.getSetCookie()) if (c.startsWith('wv_session=')) cookie = c.split(';')[0]
if (!login.ok) { console.error('login failed'); process.exit(1) }

const meta = await (await fetch(`${BASE}/api/builds/${BUILD_ID}`, { headers: { cookie } })).json()
console.log('build status:', meta.build.status, '| size:', meta.build.apkSize)

const res = await fetch(`${BASE}/api/builds/${BUILD_ID}/download`, { headers: { cookie } })
if (!res.ok) { console.error('download failed', res.status); process.exit(1) }
const buf = Buffer.from(await res.arrayBuffer())
fs.writeFileSync(OUT, buf)
console.log('saved', OUT, buf.length, 'bytes')
