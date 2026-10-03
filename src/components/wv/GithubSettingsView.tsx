'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Github, Check, Loader2, ExternalLink, ShieldCheck, AlertTriangle, ArrowLeft, Cloud, Info,
} from 'lucide-react'

interface GithubStatus {
  configured: boolean
  repo: string | null
  siteOrigin: string | null
  tokenMasked: string | null
  source: string | null
  tokenValid: boolean | null
  login: string | null
}

export default function GithubSettingsView({ embedded = false }: { embedded?: boolean }) {
  const { setView, goBack, showToast } = useApp()
  const [status, setStatus] = useState<GithubStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState('')
  const [siteOrigin, setSiteOrigin] = useState('')
  const [saving, setSaving] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const [setupResult, setSetupResult] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const res = await fetch('/api/settings/github')
      const data = await res.json()
      setStatus(data)
      setRepo(data.repo || '')
      setSiteOrigin(data.siteOrigin || '')
    } catch {
      setStatus(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/settings/github')
      .then((r) => r.json())
      .then((d) => {
        setStatus(d)
        setRepo(d.repo || '')
        setSiteOrigin(d.siteOrigin || '')
        setLoading(false)
      })
      .catch(() => {
        setStatus(null)
        setLoading(false)
      })
  }, [])

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/settings/github', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token || undefined, repo, siteOrigin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Save failed')
        return
      }
      setToken('')
      showToast('GitHub settings saved ✓')
      await load()
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  const setup = async () => {
    setError('')
    setSetupResult(null)
    setSettingUp(true)
    try {
      const res = await fetch('/api/settings/github/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createIfMissing: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Setup failed')
        return
      }
      setSetupResult(
        `Connected as @${data.login} · repo ${data.createdRepo ? 'created' : 'verified'} · workflow ${
          data.workflowUpdated ? 'installed ✓' : 'checked'
        } on branch ${data.defaultBranch}`
      )
      showToast('GitHub build repo ready ✓')
      await load()
    } catch {
      setError('Network error')
    }
    setSettingUp(false)
  }

  const configured = Boolean(status?.configured)

  return (
    <div className={embedded ? '' : 'pb-24'}>
      {!embedded && (
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16 max-w-2xl mx-auto">
          <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
            <Github className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">GitHub Builds</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Real APK builds on GitHub Actions runners</p>
          </div>
        </div>
      </header>
      )}

      <main className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">
        {/* status card */}
        <section
          className={`rounded-3xl p-5 text-white relative overflow-hidden ${
            configured ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' : 'bg-gradient-to-br from-slate-700 to-slate-600'
          }`}
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-xl" />
          {loading ? (
            <div className="flex items-center gap-3 py-4">
              <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Checking configuration…</span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                  {configured && status?.tokenValid ? <ShieldCheck className="w-7 h-7 text-emerald-400" /> : <Cloud className="w-7 h-7 text-white/80" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-lg leading-snug">
                    {configured ? (status?.tokenValid ? 'Connected ✓' : 'Token problem ⚠') : 'Not connected'}
                  </div>
                  <div className="text-white/75 text-xs mt-0.5">
                    {configured
                      ? status?.tokenValid
                        ? `@${status.login} · ${status.repo}`
                        : 'Saved token was rejected by GitHub — re-save a fresh one'
                      : 'Add your GitHub token below to enable cloud builds'}
                  </div>
                </div>
              </div>
              {configured && status?.repo && (
                <div className="mt-4 flex items-center gap-2 text-xs">
                  <a href={`https://github.com/${status.repo}/actions`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-3 py-1.5 font-bold">
                    View Actions runs <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  {status.siteOrigin ? (
                    <span className="text-white/60">Site URL: {status.siteOrigin.slice(0, 42)}</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-amber-300 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Public Site URL missing
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* how it works */}
        <section className="rounded-2xl bg-violet-50 border border-violet-50 p-4 text-sm text-blue-900">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-bold">কিভাবে কাজ করে / How it works</p>
              <p className="text-[12.5px] leading-relaxed">
                Build চাপলে আপনার project একটা সম্পূর্ণ Gradle Android project হয়ে GitHub-এ পাঠানো হয়। GitHub-এর নিজস্ব runner-এ আসল
                Android SDK + Gradle দিয়ে APK compile হয়, তারপর সেটা এই সাইটে ফিরে এসে download করা যায়। পুরোটাই আসল বিল্ড — কোনো
                simulation নেই।
              </p>
            </div>
          </div>
        </section>

        {/* token + repo */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-slate-900">1 · GitHub Token &amp; Repo</h2>
            {status?.tokenMasked && <span className="text-[10px] font-mono text-slate-400 bg-slate-100 rounded-full px-2.5 py-1">{status.tokenMasked}</span>}
          </div>

          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">PERSONAL ACCESS TOKEN *</label>
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={status?.tokenMasked ? '(saved — leave empty to keep)' : 'ghp_••••••••••••••••'}
              className="h-12 rounded-xl font-mono text-sm"
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              Classic token with <b className="text-slate-600">repo</b> + <b className="text-slate-600">workflow</b> scopes.{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=ApkForge%20APK%20Builder"
                target="_blank"
                rel="noreferrer"
                className="text-slate-900 font-bold inline-flex items-center gap-1"
              >
                Create one here <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">BUILD REPO (OWNER/NAME) *</label>
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="yourname/apkforge-builds" className="h-12 rounded-xl font-mono text-sm" />
            <p className="text-[11px] text-slate-400 mt-1.5">
              না থাকলে Setup চাপলে আমরা নতুন private repo তৈরি করে দেব। Free account-এ private repo-তে মাসে 2000 free Actions
              minutes পাওয়া যায়।
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">PUBLIC SITE URL</label>
            <Input value={siteOrigin} onChange={(e) => setSiteOrigin(e.target.value)} placeholder="https://your-site.example.com" className="h-12 rounded-xl text-sm" />
            <p className="text-[11px] text-slate-400 mt-1.5">
              এই সাইটের public https:// address — GitHub runner এই address থেকে project source নামাবে এবং build শেষে callback পাঠাবে।
              localhost হলে GitHub পারবে না।
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving} className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-900 text-white font-extrabold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
            </Button>
            <Button
              onClick={setup}
              disabled={settingUp || (!configured && !token && !repo)}
              className="flex-1 h-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold"
            >
              {settingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />} Setup repo
            </Button>
          </div>

          {setupResult && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-sm text-emerald-800 font-medium">{setupResult}</div>
          )}
          {error && <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 font-medium">{error}</div>}
        </section>

        {/* engine info */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
          <h2 className="font-extrabold text-slate-900 mb-3">2 · Build Engine</h2>
          <div className="space-y-2.5">
            <div className={`flex items-center gap-3 rounded-xl p-3 border ${configured ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
              <Cloud className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-sm">GitHub Actions {configured ? '— ACTIVE' : '— Setup required'}</div>
                <div className={`text-[11px] ${configured ? 'text-white/70' : 'text-slate-400'}`}>
                  Ubuntu runner · JDK 17 · Gradle 8.9 · AGP 8.5.2 · Android SDK 34 — আসল Gradle compile
                </div>
              </div>
              {configured && <Check className="w-5 h-5 text-emerald-400" />}
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            এটাই একমাত্র build engine — সব APK GitHub Actions এ তৈরি হয়। Fine-grained token হলে দরকার:{' '}
            <b>Contents: Read and write</b>, <b>Actions: Read and write</b>, আর repo তৈরির জন্য <b>Administration: Read and write</b>.
          </p>
        </section>
      </main>
    </div>
  )
}
