'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/lib/store'
import {
  Zap, Check, X, Clock, Copy, ChevronUp, ChevronDown, Loader2, Github, ExternalLink,
  Terminal, AlertTriangle, Sparkles, Rocket, RefreshCw, Download, Package,
} from 'lucide-react'
import type { BuildDTO } from '@/lib/types'

const STEPS = [
  { name: 'Connect', icon: Rocket, desc: 'Booting runner' },
  { name: 'Configure', icon: Package, desc: 'Setting up Gradle' },
  { name: 'Package', icon: Terminal, desc: 'Compiling sources' },
  { name: 'Sign', icon: Check, desc: 'Building APK' },
  { name: 'Done', icon: Sparkles, desc: 'Ready to install' },
]

export default function ConsoleView() {
  const { currentBuild, openReady, setView, goBack, showToast, setUser, user } = useApp()
  const [build, setBuild] = useState<BuildDTO | null>(currentBuild)
  const [elapsed, setElapsed] = useState(0)
  const [logsOpen, setLogsOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const termRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigated = useRef(false)

  useEffect(() => {
    if (!build) return
    const tick = () => {
      if (build.startedAt) {
        const base = new Date(build.startedAt).getTime()
        if (build.completedAt) {
          setElapsed(Math.max(0, Math.floor((new Date(build.completedAt).getTime() - base) / 1000)))
        } else {
          setElapsed(Math.max(0, Math.floor((Date.now() - base) / 1000)))
        }
      }
    }
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [build?.startedAt, build?.completedAt])

  useEffect(() => {
    if (!build || ['success', 'failed', 'canceled'].includes(build.status)) return
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/builds/${build.id}`)
        const data = await res.json()
        if (data.build) setBuild(data.build)
      } catch {}
    }, 1500)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [build?.id, build?.status])

  useEffect(() => {
    if (build?.status === 'success' && !navigated.current) {
      navigated.current = true
      setTimeout(() => {
        openReady(build)
        fetch('/api/auth/me').then((r) => r.json()).then((d) => d.user && setUser(d.user)).catch(() => {})
      }, 900)
    }
  }, [build?.status])

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [build?.logs])

  if (!build) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <button onClick={() => goBack()} className="text-slate-900 font-bold">
          Back to Home
        </button>
      </div>
    )
  }

  const stepIndex = STEPS.findIndex(s => s.name === build.currentStep)
  const activeStep = build.status === 'success' ? STEPS.length : build.status === 'queued' ? -1 : stepIndex

  const copyLogs = () => {
    navigator.clipboard?.writeText(build.logs || '').then(
      () => {
        showToast('Logs copied')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      () => showToast('Copy failed')
    )
  }

  const cancelBuild = async () => {
    const res = await fetch(`/api/builds/${build.id}/cancel`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      setBuild(data.build)
      showToast('Build canceled')
    }
  }

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')} : ${String(s % 60).padStart(2, '0')}`

  const isRunning = ['queued', 'building'].includes(build.status)
  const isFailed = build.status === 'failed' || build.status === 'canceled'
  const isSuccess = build.status === 'success'

  return (
    <div className="pb-32 min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16 max-w-3xl mx-auto">
          <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Back">
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-600/25">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Build Console</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Live status, logs and output for your APK build</p>
          </div>
          {isRunning && (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </div>
          )}
        </div>
      </header>

      <main className="px-4 pt-5 space-y-4 max-w-3xl mx-auto">
        {/* Status hero card */}
        <section
          className={`relative rounded-3xl p-6 text-white overflow-hidden shadow-xl transition-all ${
            isFailed
              ? 'bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 shadow-rose-600/20'
              : isSuccess
                ? 'bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 shadow-emerald-600/20'
                : 'bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900 shadow-violet-950/30'
          }`}
        >
          {/* Decorative background */}
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-violet-500/15 blur-2xl" />

          <div className="relative">
            <div className="flex items-start gap-4">
              {/* Status icon */}
              <div className="relative shrink-0">
                {isSuccess ? (
                  <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg">
                    <Check className="w-8 h-8" strokeWidth={3} />
                  </div>
                ) : isFailed ? (
                  <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg">
                    <X className="w-8 h-8" strokeWidth={3} />
                  </div>
                ) : isRunning ? (
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                    <Clock className="w-8 h-8" />
                  </div>
                )}
                {/* Pulse ring for running */}
                {isRunning && (
                  <div className="absolute inset-0 rounded-2xl border-2 border-white/40 animate-ping" />
                )}
              </div>

              {/* Status text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black tracking-widest uppercase opacity-70">
                    {isSuccess ? 'Build Complete' : isFailed ? 'Build Failed' : isRunning ? 'Building' : 'Queued'}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold leading-tight">
                  {isSuccess
                    ? `"${build.appName}" is ready 🎉`
                    : isFailed
                      ? `Build failed`
                      : isRunning
                        ? `Building "${build.appName}"...`
                        : `Waiting to build "${build.appName}"`}
                </h2>
                <p className="text-white/75 text-xs mt-1.5 leading-relaxed">
                  {isSuccess
                    ? 'Your APK has been built successfully and is ready to download.'
                    : isFailed
                      ? build.error || 'Something went wrong on the build runner. Check the logs below for details.'
                      : isRunning
                        ? 'This usually takes 2-5 minutes — feel free to stay on this page.'
                        : 'Your build is queued and will start automatically.'}
                </p>
              </div>

              {/* Timer */}
              <div className="text-right shrink-0">
                <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-md rounded-full px-3 py-1.5 text-sm font-extrabold border border-white/20">
                  <Clock className="w-3.5 h-3.5" /> {fmtTime(elapsed)}
                </div>
                {isRunning && (
                  <div className="flex items-center justify-end gap-1 text-[10px] font-bold mt-2 text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {isRunning && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-white/80">Progress</span>
                  <span className="text-[11px] font-extrabold">{build.progress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all duration-500 relative"
                    style={{ width: `${Math.max(5, build.progress)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/30 animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {/* Steps timeline */}
            <div className="mt-6 flex items-start">
              {STEPS.map((s, i) => {
                const done = isSuccess || (isRunning && i < activeStep)
                const current = isRunning && i === activeStep
                const StepIcon = s.icon
                return (
                  <div key={s.name} className="flex-1 flex flex-col items-center relative">
                    {i > 0 && (
                      <div
                        className={`absolute top-5 right-1/2 h-0.5 transition-colors duration-300 ${
                          done || current ? 'bg-white/80' : 'bg-white/20'
                        }`}
                        style={{ right: '50%', width: '100%' }}
                      />
                    )}
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center relative z-10 transition-all duration-300 ${
                        done
                          ? 'bg-white text-emerald-600 shadow-md'
                          : current
                            ? 'bg-white text-slate-900 shadow-lg scale-110'
                            : 'bg-white/10 text-white/60 border border-white/20'
                      }`}
                    >
                      {done ? (
                        <Check className="w-4 h-4" strokeWidth={3} />
                      ) : current ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <StepIcon className="w-4 h-4" />
                      )}
                    </div>
                    <span className={`text-[10px] mt-2 font-bold transition-colors ${done || current ? 'text-white' : 'text-white/50'}`}>
                      {s.name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* App info strip */}
        <section className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <div className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">App Name</div>
              <div className="text-sm font-bold text-slate-900 truncate mt-0.5">{build.appName}</div>
            </div>
            <div>
              <div className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">Package</div>
              <div className="text-sm font-mono text-slate-700 truncate mt-0.5">{build.packageName}</div>
            </div>
            <div>
              <div className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">Version</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">v{build.versionName} ({build.versionCode})</div>
            </div>
            <div>
              <div className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">Engine</div>
              <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                {build.provider === 'github' ? <Github className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
                {build.provider === 'github' ? 'GitHub Actions' : 'Local'}
              </div>
            </div>
          </div>
          {build.apkSize && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs">
              <Package className="w-3.5 h-3.5 text-emerald-500" />
              <span className="font-bold text-slate-700">APK size:</span>
              <span className="text-slate-500">{build.apkSize}</span>
            </div>
          )}
        </section>

        {/* Terminal */}
        <section className="rounded-2xl bg-[#0d1220] shadow-xl overflow-hidden border border-slate-800/50">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
            <span className="w-3 h-3 rounded-full bg-red-500/90" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/90" />
            <span className="w-3 h-3 rounded-full bg-green-500/90" />
            <span className="text-slate-400 text-xs font-mono ml-2 flex-1 truncate">
              {build.provider === 'github' ? 'github-actions — build output' : 'apkforge-builder — build output'}
            </span>
            <button
              onClick={() => setLogsOpen(!logsOpen)}
              className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/5 rounded-full px-3 py-1.5 hover:bg-white/10 transition-colors"
            >
              {logsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {logsOpen ? 'Hide' : 'Show'}
            </button>
            <button
              onClick={copyLogs}
              className={`flex items-center gap-1 text-[11px] font-bold rounded-full px-3 py-1.5 transition-all ${
                copied ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-300 bg-white/5 hover:bg-white/10'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          {logsOpen && (
            <div
              ref={termRef}
              className="p-4 h-64 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-300/90 whitespace-pre-wrap break-all"
            >
              {build.logs || 'Connecting to build runner...'}
              {isRunning && (
                <span className="inline-block w-2 h-3.5 bg-violet-400 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          )}
        </section>

        {/* GitHub run link */}
        {build.provider === 'github' && build.runUrl && (
          <a
            href={build.runUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-2xl bg-white border border-slate-200/70 px-4 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
              <Github className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div>View this build run on GitHub</div>
              <div className="text-[11px] text-slate-400 font-normal truncate">See full workflow logs, artifacts and run details</div>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
          </a>
        )}

        {/* Error detail */}
        {(isFailed) && (
          <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 p-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-rose-900 text-sm">Build failed</div>
                <div className="text-xs text-rose-700 mt-1 leading-relaxed break-words">
                  {build.error || 'Something went wrong on the build runner.'}
                </div>
                <button
                  onClick={() => setView('build')}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-full px-4 py-2 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" /> Start new build
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {isRunning ? (
            <button
              onClick={cancelBuild}
              className="flex-1 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" /> Cancel Build
            </button>
          ) : isSuccess ? (
            <button
              onClick={() => openReady(build)}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 font-bold text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Download APK
            </button>
          ) : (
            <button
              onClick={() => setView('build')}
              className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 font-bold text-white shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Start New Build
            </button>
          )}
          <button
            onClick={() => goBack()}
            className="px-5 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Home
          </button>
        </div>
      </main>
    </div>
  )
}
