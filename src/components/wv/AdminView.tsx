'use client'

import BrandMark from '@/components/wv/BrandMark'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { useWvEvent } from '@/lib/realtime'
import { ArrowLeft, ShieldCheck, LayoutDashboard, Cpu, Smartphone, Folder, Download, CreditCard, Star, CheckCircle2, XCircle, Loader2, UploadCloud, Trash2, PackageCheck, CloudUpload, KeyRound, Save, Users, Search, Ban, Wallet, RotateCcw, TrendingUp, Activity, Zap, Crown, Plus, Pencil, X, Sparkles } from 'lucide-react'
import GithubSettingsView from '@/components/wv/GithubSettingsView'
import type { AppReleaseDTO, BuildDTO, StatsDTO, PlanDTO } from '@/lib/types'

/**
 * Admin Panel — owner-only control center (Task 7 / Task 11 / Task 15 / Task 17):
 * • Dashboard tab — platform stats & recent builds
 * • Users tab — full user management (search, wallet, plan, suspend, delete)
 * • Engine tab — build engine configuration (GitHub settings live ONLY here;
 *   regular users never see how APKs are built)
 * • App tab — publish & manage the official Android app release that users
 *   download from the website (Home banner, More menu, Download App page)
 * • Pay tab — auto payment gateway settings (Payment URL + API KEY)
 */

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

function AppReleasePanel() {
  const { showToast } = useApp()
  const [release, setRelease] = useState<AppReleaseDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [versionName, setVersionName] = useState('')
  const [versionCode, setVersionCode] = useState('')
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let ok = true
    const load = () =>
      fetch('/api/app')
        .then((r) => r.json())
        .then((d) => {
          if (ok) setRelease(d.release || null)
        })
        .catch(() => {})
        .finally(() => {
          if (ok) setLoading(false)
        })
    load()
    const t = setInterval(load, 10000)
    return () => {
      ok = false
      clearInterval(t)
    }
  }, [])

  // Real-time: releases published from the Android app appear here instantly
  useWvEvent(['app'], () => {
    fetch('/api/app')
      .then((r) => r.json())
      .then((d) => setRelease(d.release || null))
      .catch(() => {})
  })

  const publish = async () => {
    if (!file) {
      showToast('Choose an .apk file first')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('apk', file)
      if (versionName.trim()) fd.append('versionName', versionName.trim())
      if (versionCode.trim()) fd.append('versionCode', versionCode.trim())
      if (notes.trim()) fd.append('notes', notes.trim())
      const res = await fetch('/api/app', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok) {
        showToast(d.error || 'Publish failed')
      } else {
        setRelease(d.release)
        setFile(null)
        setVersionName('')
        setVersionCode('')
        setNotes('')
        showToast(`App v${d.release.versionName} published ✓`)
      }
    } catch {
      showToast('Publish failed. Please try again.')
    }
    setUploading(false)
  }

  const removeRelease = async () => {
    if (!release) return
    if (!confirm(`Unpublish app v${release.versionName}? Users will no longer be able to download it.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/app/${release.id}`, { method: 'DELETE' })
      if (res.ok) {
        showToast('Release unpublished')
        // re-fetch: a previous release may have been auto-promoted
        const d = await fetch('/api/app').then((r) => r.json())
        setRelease(d.release || null)
      } else {
        const d = await res.json().catch(() => ({}))
        showToast(d.error || 'Delete failed')
      }
    } catch {
      showToast('Delete failed')
    }
    setDeleting(false)
  }

  if (loading) {
    return (
      <main className="px-4 pt-4 max-w-2xl mx-auto">
        <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
      </main>
    )
  }

  return (
    <main className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">
      {/* Current release */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h2 className="font-extrabold text-slate-900 text-sm mb-3 flex items-center gap-1.5">
          <PackageCheck className="w-4 h-4 text-emerald-500" /> Published app release
        </h2>
        {release ? (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0">
              <BrandMark className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900">ApkForge Android App</span>
                <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">LIVE</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                v{release.versionName} ({release.versionCode}) • {fmtSize(release.size)} • {release.downloads} downloads
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Published {new Date(release.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
            </div>
            <button
              onClick={removeRelease}
              disabled={deleting}
              className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 transition-colors shrink-0"
              aria-label="Unpublish release"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-5 text-center">
            <p className="text-sm text-slate-400 font-medium">No release published yet</p>
            <p className="text-xs text-slate-400 mt-1">Upload an APK below — it becomes available on the Download App page instantly.</p>
          </div>
        )}
        {release && (
          <p className="text-[11px] text-slate-400 mt-3 leading-snug">
            Users download this APK from Home → Download our Android App, the More menu, and the Download App page. Publishing a new release replaces the old one automatically.
          </p>
        )}
      </section>

      {/* Publish form */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
        <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
          <CloudUpload className="w-4 h-4 text-slate-700" /> Publish new release
        </h2>

        <label className="block cursor-pointer">
          <input
            type="file"
            accept=".apk"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <div className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${file ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:border-violet-400 hover:bg-violet-50/30'}`}>
            <UploadCloud className={`w-7 h-7 mx-auto ${file ? 'text-emerald-500' : 'text-slate-300'}`} />
            {file ? (
              <>
                <p className="text-sm font-bold text-emerald-600 mt-2 truncate">{file.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{fmtSize(file.size)} — tap to change</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-500 mt-2">Choose APK file</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Only .apk files • max 200 MB</p>
              </>
            )}
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">VERSION NAME</label>
            <input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="e.g. 2.3"
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/40"
            />
          </div>
          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">VERSION CODE</label>
            <input
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="e.g. 3"
              inputMode="numeric"
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/40"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">RELEASE NOTES (OPTIONAL)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What's new in this version…"
            className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/40 resize-none"
          />
        </div>

        <button
          onClick={publish}
          disabled={uploading || !file}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
          {uploading ? 'Publishing…' : 'Publish release'}
        </button>
        {uploading && <p className="text-[11px] text-slate-400 text-center">Uploading APK — please keep this page open…</p>}
      </section>
    </main>
  )
}

/**
 * User management (Task 17) — Admin Panel → Users tab.
 * Search accounts, expand a row and manage it: wallet balance (set/add/
 * subtract), plan (Free/Pro), password reset, suspend/restore and delete.
 * Suspend + delete also kill the user's active sessions immediately.
 */
type AdminUser = {
  id: string
  name: string
  email: string
  wallet: number
  plan: string
  banned: boolean
  referralCode: string
  createdAt: string
  admin?: boolean
  _count: { projects: number; builds: number; payments: number }
}

function UsersPanel() {
  const { showToast } = useApp()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [walletInput, setWalletInput] = useState('')
  const [passInput, setPassInput] = useState('')

  const load = () =>
    fetch(`/api/admin/users`)
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  // live refresh: users edited/banned/deleted anywhere (site or app)
  useWvEvent(['users'], () => load())

  const patch = async (u: AdminUser, body: Record<string, unknown>, okMsg: string) => {
    setBusy(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(okMsg)
        setWalletInput('')
        setPassInput('')
        await load()
      } else {
        showToast(d.error || 'Update failed')
      }
    } catch {
      showToast('Update failed')
    }
    setBusy(null)
  }

  const del = async (u: AdminUser) => {
    if (!confirm(`Delete ${u.name} (${u.email}) permanently?\nAll their projects, builds and payments are removed too.`)) return
    setBusy(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast('User deleted')
        setOpenId(null)
        await load()
      } else {
        showToast(d.error || 'Delete failed')
      }
    } catch {
      showToast('Delete failed')
    }
    setBusy(null)
  }

  if (loading) {
    return (
      <main className="px-4 pt-4 max-w-2xl mx-auto">
        <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
      </main>
    )
  }

  const input = 'w-full h-10 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-700/40'
  const smallBtn = 'px-3 h-9 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <main className="px-4 pt-4 space-y-3 max-w-2xl mx-auto pb-4">
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-700" /> User management
          </h2>
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-violet-50 text-slate-900">{users.length} ACCOUNTS</span>
        </div>
      </section>

      {users.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-6">No users yet.</p>
      )}

      {users.map((u) => {
        const open = openId === u.id
        return (
          <section key={u.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <button
              onClick={() => { setOpenId(open ? null : u.id); setWalletInput(''); setPassInput('') }}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shrink-0 ${u.banned ? 'bg-slate-400' : 'bg-slate-900'}`}>
                {u.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-800 truncate">{u.name}</span>
                  {u.banned && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">SUSPENDED</span>}
                </div>
                <div className="text-[11px] text-slate-400 font-mono truncate">{u.email}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {u._count.projects} projects · {u._count.builds} builds · joined {new Date(u.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-extrabold text-slate-800">৳{u.wallet}</div>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${u.plan === 'Pro' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{u.plan.toUpperCase()}</span>
              </div>
            </button>

            {open && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                {/* wallet */}
                <div>
                  <p className="text-[10px] font-extrabold tracking-widest text-slate-400 mb-1.5">WALLET BALANCE (CURRENT: ৳{u.wallet})</p>
                  <div className="flex gap-2">
                    <input
                      value={walletInput}
                      onChange={(e) => setWalletInput(e.target.value.replace(/[^0-9-]/g, ''))}
                      placeholder="Amount ৳"
                      inputMode="numeric"
                      className={input}
                    />
                    <button disabled={busy === u.id || !walletInput} onClick={() => patch(u, { walletSet: parseInt(walletInput, 10) }, `Wallet set to ৳${parseInt(walletInput, 10) || 0}`)} className={`${smallBtn} bg-slate-900 text-white`}>Set</button>
                    <button disabled={busy === u.id || !walletInput} onClick={() => patch(u, { walletAdjust: Math.abs(parseInt(walletInput, 10) || 0) }, `৳${Math.abs(parseInt(walletInput, 10) || 0)} added`)} className={`${smallBtn} bg-emerald-600 text-white`}>+ Add</button>
                    <button disabled={busy === u.id || !walletInput} onClick={() => patch(u, { walletAdjust: -Math.abs(parseInt(walletInput, 10) || 0) }, `৳${Math.abs(parseInt(walletInput, 10) || 0)} deducted`)} className={`${smallBtn} bg-slate-200 text-slate-700`}>− Cut</button>
                  </div>
                </div>

                {/* plan (platform admins are managed via config, not here) */}
                {!u.admin && (
                  <div>
                    <p className="text-[10px] font-extrabold tracking-widest text-slate-400 mb-1.5">PLAN</p>
                    <div className="flex gap-2">
                      {['Free', 'Pro'].map((p) => (
                        <button
                          key={p}
                          disabled={busy === u.id || u.plan === p}
                          onClick={() => patch(u, { plan: p }, `Plan changed to ${p}`)}
                          className={`${smallBtn} flex-1 ${u.plan === p ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                        >
                          {p} {u.plan === p && '✓'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* password */}
                <div>
                  <p className="text-[10px] font-extrabold tracking-widest text-slate-400 mb-1.5">RESET PASSWORD</p>
                  <div className="flex gap-2">
                    <input value={passInput} onChange={(e) => setPassInput(e.target.value)} placeholder="New password (min 6 chars)" type="text" className={input} autoComplete="off" />
                    <button disabled={busy === u.id || passInput.length < 6} onClick={() => patch(u, { password: passInput }, 'Password updated ✓')} className={`${smallBtn} bg-slate-800 text-white flex items-center gap-1`}><KeyRound className="w-3.5 h-3.5" /> Set</button>
                  </div>
                </div>

                {/* suspend / delete — hidden for platform admin accounts */}
                {u.admin ? (
                  <p className="text-[10px] text-slate-400 leading-relaxed flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" /> Platform admin account — protected from suspension, edits and deletion.</p>
                ) : (
                  <>
                    <div className="flex gap-2 pt-1">
                      {u.banned ? (
                        <button disabled={busy === u.id} onClick={() => patch(u, { banned: false }, `${u.name} restored`)} className={`${smallBtn} flex-1 bg-emerald-600 text-white flex items-center justify-center gap-1.5`}><RotateCcw className="w-3.5 h-3.5" /> Restore access</button>
                      ) : (
                        <button disabled={busy === u.id} onClick={() => patch(u, { banned: true }, `${u.name} suspended`)} className={`${smallBtn} flex-1 bg-amber-500 text-white flex items-center justify-center gap-1.5`}><Ban className="w-3.5 h-3.5" /> Suspend account</button>
                      )}
                      <button disabled={busy === u.id} onClick={() => del(u)} className={`${smallBtn} flex-1 bg-red-50 text-red-600 border border-red-200 flex items-center justify-center gap-1.5`}><Trash2 className="w-3.5 h-3.5" /> Delete forever</button>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-relaxed">
                      Suspension blocks login + every API instantly and signs the user out of all devices. Delete removes all data permanently.
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
        )
      })}
    </main>
  )
}

/**
 * Payment gateway settings (AmarPay auto payment) — Admin Panel → Pay tab.
 * The gateway URL and API-KEY are stored in the Setting table and used
 * by /api/payments/auto/* to create + verify checkout sessions.
 */
function PaymentSettingsPanel() {
  const { showToast } = useApp()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)

  const load = () =>
    fetch('/api/admin/payment-settings')
      .then((r) => r.json())
      .then((d) => {
        setBaseUrl(d.baseUrl || '')
        setApiKeyMasked(d.apiKeyMasked || null)
        setConfigured(!!d.configured)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/payment-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, apiKey }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.ok) {
        setApiKeyMasked(d.apiKeyMasked || null)
        setConfigured(!!d.configured)
        setApiKey('')
        showToast(d.configured ? 'Payment settings saved — auto payment is LIVE ✓' : 'Saved. Add the API KEY to enable auto payment.')
      } else {
        showToast(d.error || 'Save failed')
      }
    } catch {
      showToast('Save failed')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <main className="px-4 pt-4 max-w-2xl mx-auto">
        <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" />
      </main>
    )
  }

  const field = 'w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-700/40'
  const labelCls = 'block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5'

  return (
    <main className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-amber-500" /> Auto payment status
          </h2>
          <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${configured ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
            {configured ? 'LIVE' : 'NOT CONFIGURED'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
          Users pay through the gateway checkout and their wallet is credited automatically after verification — no manual TrxID review.
          Until the API KEY is set, the manual bKash/Nagad/Rocket flow stays active.
        </p>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
        <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
          <KeyRound className="w-4 h-4 text-slate-700" /> Gateway credentials
        </h2>
        <div>
          <label className={labelCls}>PAYMENT URL (GATEWAY BASE URL)</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://pay.amarpayment.site" className={field} />
        </div>
        <div>
          <label className={labelCls}>API KEY {apiKeyMasked && <span className="text-slate-300 normal-case tracking-normal font-mono">(current: {apiKeyMasked})</span>}</label>
          <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={apiKeyMasked ? 'Leave empty to keep current key' : 'Your AmarPayment API key'} className={field} autoComplete="off" />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save payment settings'}
        </button>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Only the Payment URL and API KEY are needed. Keys are stored server-side and never exposed to users — Create Payment +
          Verify Payment are called from the server with the API-KEY header.
        </p>
      </section>
    </main>
  )
}

/**
 * Admin Panel → Plans tab — manage subscription plans (add/edit/delete).
 */
const ACCENT_OPTIONS = [
  { id: 'violet', label: 'Violet', tile: 'bg-violet-500', text: 'text-violet-600', chip: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { id: 'fuchsia', label: 'Fuchsia', tile: 'bg-fuchsia-500', text: 'text-fuchsia-600', chip: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200' },
  { id: 'amber', label: 'Amber', tile: 'bg-amber-500', text: 'text-amber-600', chip: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { id: 'emerald', label: 'Emerald', tile: 'bg-emerald-500', text: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { id: 'slate', label: 'Slate', tile: 'bg-slate-700', text: 'text-slate-600', chip: 'bg-slate-100 text-slate-700 ring-slate-200' },
] as const

function accentMeta(id: string) {
  return ACCENT_OPTIONS.find((a) => a.id === id) || ACCENT_OPTIONS[0]
}

function PlansPanel() {
  const { showToast } = useApp()
  const [plans, setPlans] = useState<PlanDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PlanDTO | null>(null)
  const [creating, setCreating] = useState(false)

  const load = () => {
    fetch('/api/admin/plans')
      .then((r) => r.json())
      .then((d) => { setPlans(d.plans || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useWvEvent(['plans'], () => load())

  const del = async (p: PlanDTO) => {
    if (!confirm(`Delete plan "${p.name}"?\n\nAny user on this plan will be downgraded to Free.`)) return
    const res = await fetch(`/api/admin/plans/${p.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    if (res.ok) { showToast(`"${p.name}" deleted — affected users moved to Free`); load() }
    else showToast(d.error || 'Delete failed')
  }

  const toggleActive = async (p: PlanDTO) => {
    const res = await fetch(`/api/admin/plans/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !p.isActive }) })
    if (res.ok) { showToast(`"${p.name}" ${p.isActive ? 'hidden' : 'published'}`); load() }
    else showToast('Update failed')
  }

  const togglePopular = async (p: PlanDTO) => {
    const res = await fetch(`/api/admin/plans/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPopular: !p.isPopular }) })
    if (res.ok) { showToast(`"${p.name}" ${p.isPopular ? 'unset' : 'marked'} as recommended`); load() }
    else showToast('Update failed')
  }

  if (loading) {
    return (<main className="px-4 pt-4 max-w-3xl mx-auto"><div className="h-48 rounded-2xl bg-slate-100 animate-pulse" /></main>)
  }

  return (
    <main className="px-4 pt-5 space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
            <span className="inline-flex w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 items-center justify-center shadow-md shadow-violet-500/25"><Crown className="w-4 h-4 text-white" /></span>
            Subscription Plans
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Add, edit, and delete the plans users can subscribe to.</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold text-sm shadow-md shadow-violet-500/25 transition-all">
          <Plus className="w-4 h-4" /> New Plan
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
          <Crown className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-bold text-slate-700">No plans yet</p>
          <p className="text-xs text-slate-400 mt-1">Click &ldquo;New Plan&rdquo; to create your first subscription plan.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((p) => {
            const accent = accentMeta(p.accent)
            const features = p.features.split('\n').filter(Boolean)
            return (
              <div key={p.id} className={`group rounded-2xl bg-white border shadow-sm hover:shadow-md hover:shadow-slate-900/5 transition-all overflow-hidden ${p.isActive ? 'border-slate-100' : 'border-slate-200 opacity-70'}`}>
                <div className={`h-1.5 w-full ${accent.tile}`} />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${accent.chip} ring-1 flex items-center justify-center shrink-0`}><Crown className={`w-5 h-5 ${accent.text}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-slate-900 text-lg">{p.name}</h3>
                        {p.isPopular && <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-slate-900 px-2 py-0.5 rounded-full"><Sparkles className="w-2.5 h-2.5" /> Recommended</span>}
                        {!p.isActive && <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Hidden</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{p.description || 'No description'}</p>
                      <div className="flex items-baseline gap-2 mt-2">
                        <span className="text-2xl font-extrabold text-slate-900 tabular-nums tracking-tight">৳{p.price}</span>
                        <span className="text-xs text-slate-400 font-semibold">/month</span>
                        {p.priceYearly > 0 && <span className="text-xs text-slate-400 font-semibold ml-2">· ৳{p.priceYearly}/year</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-colors"><Pencil className="w-3 h-3" /> Edit</button>
                      <button onClick={() => del(p)} disabled={p.name.toLowerCase() === 'free'} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title={p.name.toLowerCase() === 'free' ? 'The Free plan cannot be deleted' : 'Delete plan'}><Trash2 className="w-3 h-3" /> Del</button>
                    </div>
                  </div>

                  {features.length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-4 pt-4 border-t border-slate-50">
                      {features.slice(0, 6).map((f, i) => (<div key={i} className="flex items-center gap-2 text-xs text-slate-600"><CheckCircle2 className={`w-3.5 h-3.5 ${accent.text} shrink-0`} /><span className="truncate">{f}</span></div>))}
                      {features.length > 6 && <div className="text-[11px] text-slate-400 font-semibold sm:col-span-2">+{features.length - 6} more</div>}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-50">
                    <button onClick={() => toggleActive(p)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-colors ${p.isActive ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />{p.isActive ? 'Published' : 'Hidden'}
                    </button>
                    <button onClick={() => togglePopular(p)} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold transition-colors ${p.isPopular ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                      <Sparkles className="w-3 h-3" /> {p.isPopular ? 'Recommended' : 'Mark recommended'}
                    </button>
                    <span className="text-[11px] text-slate-400 ml-auto">Order #{p.sortOrder}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(creating || editing) && (
        <PlanFormModal plan={editing} onClose={() => { setCreating(false); setEditing(null) }} onSaved={() => { setCreating(false); setEditing(null); load() }} showToast={showToast} />
      )}
    </main>
  )
}

function PlanFormModal({ plan, onClose, onSaved, showToast }: { plan: PlanDTO | null; onClose: () => void; onSaved: () => void; showToast: (s: string) => void }) {
  const isEdit = !!plan
  const [name, setName] = useState(plan?.name || '')
  const [description, setDescription] = useState(plan?.description || '')
  const [price, setPrice] = useState(plan ? String(plan.price) : '0')
  const [priceYearly, setPriceYearly] = useState(plan ? String(plan.priceYearly) : '0')
  const [features, setFeatures] = useState(plan?.features || '')
  const [accent, setAccent] = useState(plan?.accent || 'violet')
  const [isPopular, setIsPopular] = useState(plan?.isPopular ?? false)
  const [isActive, setIsActive] = useState(plan?.isActive ?? true)
  const [sortOrder, setSortOrder] = useState(plan ? String(plan.sortOrder) : '0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    if (name.trim().length < 2) { setError('Plan name must be at least 2 characters'); return }
    setSaving(true)
    try {
      const payload = { name: name.trim(), description: description.trim(), price: parseInt(price, 10) || 0, priceYearly: parseInt(priceYearly, 10) || 0, features: features.trim(), accent, isPopular, isActive, sortOrder: parseInt(sortOrder, 10) || 0 }
      const res = isEdit
        ? await fetch(`/api/admin/plans/${plan!.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || 'Save failed'); setSaving(false); return }
      showToast(isEdit ? `Plan "${name.trim()}" updated` : `Plan "${name.trim()}" created`)
      onSaved()
    } catch { setError('Network error') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 max-h-[92dvh] overflow-y-auto ring-1 ring-slate-200/50 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-violet-600 uppercase mb-1"><Crown className="w-3 h-3" /> {isEdit ? 'Edit plan' : 'New plan'}</div>
            <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{isEdit ? plan!.name : 'Create Subscription Plan'}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">NAME *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pro / Business / Premium" className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">SORT ORDER</label>
              <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">DESCRIPTION</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short tagline shown under the plan name." rows={2} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">PRICE / MONTH (৳)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">PRICE / YEAR (৳)</label>
              <input value={priceYearly} onChange={(e) => setPriceYearly(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">FEATURES (one per line)</label>
            <textarea value={features} onChange={(e) => setFeatures(e.target.value)} placeholder={'Unlimited APK builds\nOneSignal push notifications\nRemove watermark'} rows={5} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 resize-none" />
          </div>

          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">ACCENT COLOR</label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_OPTIONS.map((a) => (
                <button key={a.id} type="button" onClick={() => setAccent(a.id)} className={`group flex items-center gap-2 h-10 px-3 rounded-xl border-2 transition-all ${accent === a.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <span className={`w-5 h-5 rounded-md ${a.tile}`} />
                  <span className="text-xs font-bold text-slate-700">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={`flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all ${isPopular ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} className="w-4 h-4 accent-amber-500" />
              <div><div className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Recommended</div><div className="text-[11px] text-slate-400">Highlight on Subscription page</div></div>
            </label>
            <label className={`flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition-all ${isActive ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
              <div><div className="text-sm font-bold text-slate-800">Published</div><div className="text-[11px] text-slate-400">Visible to users</div></div>
            </label>
          </div>

          {error && <div className="rounded-xl bg-rose-50 border border-rose-100 px-3.5 py-2.5 text-sm text-rose-700 font-medium">{error}</div>}
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition-colors">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold text-sm shadow-md shadow-violet-500/25 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminView() {
  const { setView, goBack } = useApp()
  const [tab, setTab] = useState<'dashboard' | 'users' | 'plans' | 'engine' | 'app' | 'pay'>('dashboard')
  const [stats, setStats] = useState<StatsDTO | null>(null)
  const [builds, setBuilds] = useState<BuildDTO[]>([])

  useEffect(() => {
    if (tab !== 'dashboard') return
    fetch('/api/stats').then((r) => r.json()).then((d) => setStats(d.stats || null)).catch(() => {})
    fetch('/api/builds').then((r) => r.json()).then((d) => setBuilds((d.builds || []).slice(0, 6))).catch(() => {})
  }, [tab])

  // Real-time dashboard: builds started/finished anywhere (site or app) live-update
  useWvEvent(['builds', 'projects', 'wallet', 'engine', 'users'], () => {
    if (tab !== 'dashboard') return
    fetch('/api/stats').then((r) => r.json()).then((d) => setStats(d.stats || null)).catch(() => {})
    fetch('/api/builds').then((r) => r.json()).then((d) => setBuilds((d.builds || []).slice(0, 6))).catch(() => {})
  })

  const statCards = [
    { label: 'My Projects', value: String(stats?.projects ?? '—'), icon: Folder, tile: 'bg-violet-50', color: 'text-violet-600', ring: 'ring-violet-100', trend: 'total created' },
    { label: 'Downloads', value: String(stats?.downloads ?? '—'), icon: Download, tile: 'bg-emerald-50', color: 'text-emerald-600', ring: 'ring-emerald-100', trend: 'APK installs' },
    { label: 'Wallet', value: stats ? `৳${stats.wallet}` : '—', icon: CreditCard, tile: 'bg-amber-50', color: 'text-amber-600', ring: 'ring-amber-100', trend: 'current balance' },
    { label: 'Plan', value: stats?.plan ?? '—', icon: Star, tile: 'bg-violet-50', color: 'text-violet-600', ring: 'ring-violet-100', trend: 'subscription tier' },
  ]

  // derived build metrics
  const successBuilds = builds.filter((b) => b.status === 'success').length
  const failedBuilds = builds.filter((b) => b.status === 'failed').length
  const activeBuilds = builds.filter((b) => b.status === 'building' || b.status === 'queued').length
  const successRate = builds.length > 0 ? Math.round((successBuilds / builds.length) * 100) : 0

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users' as const, label: 'Users', icon: Users },
    { id: 'plans' as const, label: 'Plans', icon: Crown },
    { id: 'engine' as const, label: 'Engine', icon: Cpu },
    { id: 'app' as const, label: 'App', icon: Smartphone },
    { id: 'pay' as const, label: 'Pay', icon: CreditCard },
  ]

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16 max-w-3xl mx-auto">
          <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center shadow-md shadow-slate-900/20 ring-1 ring-slate-900/5">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Admin Panel</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Platform & build engine control center</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Admin
          </span>
        </div>
        {/* tabs */}
        <div className="px-4 pb-3 max-w-3xl mx-auto">
          <div className="flex gap-1 bg-slate-100/80 rounded-2xl p-1 ring-1 ring-slate-100 overflow-x-auto no-scrollbar">
            {tabs.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${tab === t.id ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Icon className="w-4 h-4 shrink-0" /> <span>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {tab === 'dashboard' ? (
        <main className="px-4 pt-5 space-y-5 max-w-3xl mx-auto">
          {/* hero summary card */}
          <section className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl shadow-slate-900/20">
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-violet-600/25 blur-3xl" />
            <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-emerald-400/15 blur-2xl" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.05]" aria-hidden="true">
              <defs>
                <pattern id="admin-dots" width="22" height="22" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#admin-dots)" />
            </svg>
            <div className="relative flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-amber-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-200/80">Forge overview</div>
                <h2 className="text-2xl font-extrabold tracking-tight mt-0.5">Platform health is good</h2>
                <p className="text-slate-300/90 text-xs mt-1.5 leading-relaxed max-w-md">
                  {builds.length > 0
                    ? `${builds.length} builds processed · ${successRate}% success rate · ${activeBuilds} active`
                    : 'No builds yet. Engine settings live under the Engine tab.'}
                </p>
              </div>
            </div>
            {/* mini build metric strip */}
            <div className="relative mt-5 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Success</div>
                <div className="font-extrabold text-xl mt-0.5 tabular-nums">{successBuilds}</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80 flex items-center gap-1"><XCircle className="w-3 h-3" /> Failed</div>
                <div className="font-extrabold text-xl mt-0.5 tabular-nums">{failedBuilds}</div>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md px-3 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80 flex items-center gap-1"><Loader2 className="w-3 h-3" /> Active</div>
                <div className="font-extrabold text-xl mt-0.5 tabular-nums">{activeBuilds}</div>
              </div>
            </div>
          </section>

          {/* stats grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {statCards.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.label} className="group relative bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:shadow-slate-900/5 hover:-translate-y-0.5 transition-all p-4 overflow-hidden">
                  <div className={`absolute -top-6 -right-6 w-16 h-16 rounded-full ${s.tile} opacity-50 group-hover:scale-150 transition-transform duration-500`} />
                  <div className={`relative w-10 h-10 rounded-xl ${s.tile} flex items-center justify-center ring-1 ${s.ring}`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div className="relative text-2xl font-extrabold text-slate-900 mt-2.5 tabular-nums tracking-tight">{s.value}</div>
                  <div className="relative text-xs text-slate-600 font-bold">{s.label}</div>
                  <div className="relative text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                    <TrendingUp className="w-2.5 h-2.5" /> {s.trend}
                  </div>
                </div>
              )
            })}
          </section>

          {/* recent builds */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3.5">
              <h2 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span className="inline-flex w-7 h-7 rounded-lg bg-violet-50 items-center justify-center">
                  <Activity className="w-4 h-4 text-violet-600" />
                </span>
                Recent builds
              </h2>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider tabular-nums">{builds.length} total</span>
            </div>
            {builds.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center gap-2 text-slate-400">
                <Activity className="w-5 h-5" />
                <p className="text-xs font-bold">No builds yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {builds.map((b) => (
                  <div key={b.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50/80 hover:bg-slate-100/80 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{b.appName}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{b.packageName}</div>
                    </div>
                    <span className={`flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                      b.status === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : b.status === 'failed' ? 'bg-rose-50 text-rose-600 border-rose-200'
                      : b.status === 'canceled' ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {b.status === 'success' ? <CheckCircle2 className="w-3 h-3" />
                       : b.status === 'failed' ? <XCircle className="w-3 h-3" />
                       : b.status === 'building' ? <Loader2 className="w-3 h-3 animate-spin" />
                       : <Loader2 className="w-3 h-3" />}
                      {b.status.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="text-[11px] text-slate-400 text-center">Engine settings are under the Engine tab — visible to admins only.</p>
        </main>
      ) : tab === 'users' ? (
        <UsersPanel />
      ) : tab === 'plans' ? (
        <PlansPanel />
      ) : tab === 'engine' ? (
        <GithubSettingsView embedded />
      ) : tab === 'pay' ? (
        <PaymentSettingsPanel />
      ) : (
        <AppReleasePanel />
      )}
    </div>
  )
}
