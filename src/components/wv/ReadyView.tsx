'use client'

import { useState } from 'react'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Check, Download, Share2, Smartphone, ShieldCheck, FolderOpen, Loader2, Package, Home } from 'lucide-react'
import type { BuildDTO } from '@/lib/types'

export default function ReadyView() {
  const { currentBuild, setView, goBack, showToast } = useApp()
  const [downloading, setDownloading] = useState(false)
  const build = currentBuild

  let iconSrc: string | null = null
  if (build) {
    try {
      const cfg = JSON.parse(build.config || '{}')
      if (typeof cfg.icon === 'string' && cfg.icon) iconSrc = cfg.icon
    } catch {
      iconSrc = null
    }
  }

  if (!build) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <button onClick={() => goBack()} className="text-slate-900 font-bold">
          Back to Home
        </button>
      </div>
    )
  }

  const download = () => {
    setDownloading(true)
    showToast('Download started — check your downloads folder')
    window.location.href = `/api/builds/${build.id}/download`
    setTimeout(() => setDownloading(false), 1500)
  }

  const share = async () => {
    const text = `I just built "${build.appName}" APK with ApkForge! 🚀`
    if (navigator.share) {
      try {
        await navigator.share({ title: build.appName, text })
      } catch {}
    } else {
      navigator.clipboard?.writeText(text)
      showToast('Copied — share it with your friends!')
    }
  }

  return (
    <div className="pb-28">
      <header className="bg-white border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16 max-w-2xl mx-auto">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-md shadow-emerald-500/25">
            <Check className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">APK Ready</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Build #{build.id.slice(-6).toUpperCase()} • completed</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">
        {/* App card */}
        <section className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400 p-6 text-white text-center relative overflow-hidden shadow-xl shadow-emerald-500/20">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-xl" />
          <div className="w-24 h-24 rounded-3xl bg-white/15 border border-white/30 backdrop-blur flex items-center justify-center mx-auto overflow-hidden">
            {iconSrc ? <img src={iconSrc} alt="App icon" className="w-full h-full object-cover" /> : <Package className="w-11 h-11" />}
          </div>
          <h2 className="text-2xl font-extrabold mt-4">{build.appName}</h2>
          <p className="text-emerald-100 text-xs font-mono mt-1">{build.packageName}</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <span className="bg-white/15 border border-white/25 rounded-full px-3 py-1 text-xs font-bold">v{build.versionName} ({build.versionCode})</span>
            <span className="bg-white/15 border border-white/25 rounded-full px-3 py-1 text-xs font-bold">{build.apkSize || '~15 MB'}</span>
            <span className="bg-white/15 border border-white/25 rounded-full px-3 py-1 text-xs font-bold">Min SDK 21</span>
          </div>
        </section>

        {/* Download button */}
        <Button
          onClick={download}
          disabled={downloading}
          className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-extrabold text-base shadow-xl shadow-emerald-600/25"
        >
          {downloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          Download APK ({build.apkSize || 'APK'})
        </Button>

        {/* Install steps */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <h3 className="font-extrabold text-slate-900 flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-slate-900" /> How to install
          </h3>
          <ol className="space-y-2.5 text-sm text-slate-600">
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-violet-50 text-slate-900 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">1</span>
              Download the APK file to your phone.
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-violet-50 text-slate-900 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">2</span>
              Open the file from your <b>Downloads</b> folder or notification.
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-violet-50 text-slate-900 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">3</span>
              Allow <b>"Install unknown apps"</b> if prompted (Settings → Security).
            </li>
            <li className="flex gap-2.5">
              <span className="w-5 h-5 rounded-full bg-violet-50 text-slate-900 text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">4</span>
              Tap <b>Install</b> — done! Your app appears on the home screen.
            </li>
          </ol>
          <div className="flex items-start gap-2 mt-4 text-[11px] text-slate-400 bg-slate-50 rounded-xl p-3">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            Signed with the ApkForge release key (v1 + v2 scheme). Verified safe by the build runner.
          </div>
        </section>

        {/* Build info */}
        <section className="rounded-2xl bg-white border border-slate-100 shadow-sm divide-y divide-slate-50">
          <Row label="Source" value={build.sourceType === 'kotlin' ? 'Kotlin / Java (ZIP)' : build.sourceMode === 'url' ? build.websiteUrl || 'Website URL' : 'ApkForge Project'} />
          <Row label="Built on" value={new Date(build.completedAt || build.createdAt).toLocaleString()} />
          <Row label="Builder" value={build.provider === 'github' ? 'GitHub Actions • Ubuntu runner' : 'ApkForge Builder'} />
        </section>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={share} className="h-12 rounded-2xl border-slate-200 font-bold">
            <Share2 className="w-4 h-4 mr-1.5" /> Share
          </Button>
          <Button variant="outline" onClick={() => goBack()} className="h-12 rounded-2xl border-slate-200 font-bold">
            <Home className="w-4 h-4 mr-1.5" /> Home
          </Button>
        </div>
      </main>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-slate-800 truncate max-w-[60%] text-right">{value}</span>
    </div>
  )
}
