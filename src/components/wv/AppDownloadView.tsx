'use client'

import BrandMark from '@/components/wv/BrandMark'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { useWvEvent } from '@/lib/realtime'
import {
  ChevronLeft, Smartphone, Download, ShieldCheck, Zap, LogIn, Layers,
  Radio, PackageOpen, HardDrive, Users, CircleAlert,
} from 'lucide-react'
import type { AppReleaseDTO } from '@/lib/types'

function fmtSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

const FEATURES = [
  { icon: Smartphone, tile: 'bg-violet-50', color: 'text-slate-900', title: '100% Native Android app', desc: 'Built with Kotlin — fast, smooth, no WebView shell' },
  { icon: LogIn, tile: 'bg-emerald-100', color: 'text-emerald-600', title: 'Login once, stay signed in', desc: 'Your session is remembered — no repeated logins' },
  { icon: Layers, tile: 'bg-violet-50', color: 'text-slate-900', title: 'Everything from the website', desc: 'Projects, Store, Lab, Code Editor & APK building' },
  { icon: Radio, tile: 'bg-amber-100', color: 'text-amber-500', title: 'Live build console', desc: 'Watch every build step in real time & get the APK' },
]

const STEPS = [
  'Tap the Download APK button above',
  'Allow "Install unknown apps" for your browser when asked',
  'Open the downloaded file and tap Install',
  'Open ApkForge, log in once — you stay signed in',
]

export default function AppDownloadView() {
  const { setView, goBack } = useApp()
  const [release, setRelease] = useState<AppReleaseDTO | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ok = true
    fetch('/api/app')
      .then((r) => r.json())
      .then((d) => {
        if (ok) setRelease(d.release || null)
      })
      .catch(() => {})
      .finally(() => {
        if (ok) setLoading(false)
      })
    return () => {
      ok = false
    }
  }, [])

  // Real-time: a release published/unpublished in the Admin Panel (site or app)
  // updates this page instantly
  useWvEvent(['app'], () => {
    fetch('/api/app')
      .then((r) => r.json())
      .then((d) => setRelease(d.release || null))
      .catch(() => {})
  })

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16 max-w-2xl mx-auto">
          <button onClick={() => goBack()} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200" aria-label="Back">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Download App</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">APKFORGE for Android</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="h-64 rounded-3xl bg-slate-100 animate-pulse" />
        ) : !release ? (
          <div className="rounded-3xl bg-white border border-slate-100 shadow-sm p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <PackageOpen className="w-7 h-7 text-slate-400" />
            </div>
            <h2 className="font-extrabold text-slate-900 mt-4">No app release yet</h2>
            <p className="text-sm text-slate-400 mt-1.5">Our Android app is not published yet. Please check back soon!</p>
          </div>
        ) : (
          <>
            {/* Hero */}
            <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-xl" />
              <div className="flex items-center gap-4 relative">
                <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg shrink-0">
                  <BrandMark className="w-9 h-9 text-slate-900" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-extrabold tracking-tight">APKFORGE</h2>
                  <p className="text-violet-50 text-xs font-medium">Official Android App</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] font-extrabold bg-white/15 border border-white/25 rounded-full px-2.5 py-1">v{release.versionName}</span>
                    <span className="text-[10px] font-extrabold bg-white/15 border border-white/25 rounded-full px-2.5 py-1 flex items-center gap-1"><HardDrive className="w-3 h-3" /> {fmtSize(release.size)}</span>
                    <span className="text-[10px] font-extrabold bg-white/15 border border-white/25 rounded-full px-2.5 py-1 flex items-center gap-1"><Users className="w-3 h-3" /> {release.downloads} downloads</span>
                  </div>
                </div>
              </div>

              <a
                href="/api/app/download"
                download
                className="mt-5 flex items-center justify-center gap-2 w-full bg-white text-slate-900 font-extrabold text-base py-3.5 rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform shadow-lg"
              >
                <Download className="w-5 h-5" /> Download APK
              </a>
              <p className="text-center text-violet-50 text-[11px] mt-2.5">Free • Safe & signed • Android 5.0+</p>
            </section>

            {/* Release notes */}
            {release.notes ? (
              <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5 mb-2"><CircleAlert className="w-4 h-4 text-slate-700" /> What&apos;s new in v{release.versionName}</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{release.notes}</p>
              </section>
            ) : null}

            {/* Features */}
            <section>
              <h3 className="font-extrabold text-slate-900 text-sm mb-2.5">WHY THE APP?</h3>
              <div className="space-y-2.5">
                {FEATURES.map((f) => {
                  const Icon = f.icon
                  return (
                    <div key={f.title} className="flex items-center gap-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
                      <div className={`w-11 h-11 rounded-xl ${f.tile} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-5 h-5 ${f.color}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 text-sm">{f.title}</div>
                        <div className="text-xs text-slate-400 leading-snug">{f.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Install steps */}
            <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4">
              <h3 className="font-extrabold text-slate-900 text-sm mb-3">HOW TO INSTALL</h3>
              <div className="space-y-3">
                {STEPS.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-sm text-slate-600 leading-snug">{s}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-2 mt-4 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-emerald-700 leading-snug">The APK is signed by APKFORGE. New versions are published right here — reinstall the latest APK to update.</p>
              </div>
            </section>

            <p className="text-[11px] text-slate-300 text-center flex items-center justify-center gap-1.5">
              <Zap className="w-3 h-3" /> Same account, same projects — website & app stay in sync
            </p>
          </>
        )}
      </main>
    </div>
  )
}
