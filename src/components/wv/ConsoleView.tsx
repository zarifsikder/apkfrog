'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/lib/store'
import { Zap, Check, X, Clock, Copy, ChevronUp, ChevronDown, Loader2, Github, ExternalLink } from 'lucide-react'
import type { BuildDTO } from '@/lib/types'

const STEPS = ['Connect', 'Configure', 'Package', 'Sign', 'Done']

export default function ConsoleView() {
  const { currentBuild, openReady, setView, goBack, showToast, setUser, user } = useApp()
  const [build, setBuild] = useState<BuildDTO | null>(currentBuild)
  const [elapsed, setElapsed] = useState(0)
  const [logsOpen, setLogsOpen] = useState(true)
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
        // refresh wallet/stats silently
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

  const stepIndex = STEPS.indexOf(build.currentStep)
  const activeStep = build.status === 'success' ? 5 : build.status === 'queued' ? -1 : stepIndex

  const copyLogs = () => {
    navigator.clipboard?.writeText(build.logs || '').then(
      () => showToast('Logs copied'),
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

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16 max-w-2xl mx-auto">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-md shadow-slate-900/25">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Build Console</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Live status, logs and output for your APK build</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-4 max-w-2xl mx-auto">
        {/* Status card */}
        <section
          className={`rounded-3xl p-5 text-white relative overflow-hidden ${
            build.status === 'failed' || build.status === 'canceled'
              ? 'bg-rose-600'
              : build.status === 'success'
                ? 'bg-emerald-600'
                : 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700'
          }`}
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-xl" />
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              {['success', 'failed', 'canceled'].includes(build.status) ? (
                <div className="w-14 h-14 rounded-full bg-white/15 border border-white/30 flex items-center justify-center">
                  {build.status === 'success' ? <Check className="w-7 h-7" /> : <X className="w-7 h-7" />}
                </div>
              ) : (
                <div className="w-14 h-14 rounded-full border-3 border-white/30 border-t-white border-l-white border-r-white/10 animate-spin" style={{ borderWidth: 3 }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-extrabold leading-snug">
                {build.status === 'success'
                  ? `Built "${build.appName}" ✓`
                  : build.status === 'failed'
                    ? `Build failed`
                    : build.status === 'canceled'
                      ? `Build canceled`
                      : `Building "${build.appName}" ...`}
              </h2>
              <p className="text-white/80 text-xs mt-1">
                {build.status === 'success'
                  ? 'Your APK is ready to download and install.'
                  : build.status === 'failed'
                    ? build.error || 'Something went wrong on the build runner.'
                    : build.status === 'canceled'
                      ? 'You canceled this build.'
                      : 'This usually takes a few minutes — feel free to stay on this page.'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5 text-sm font-extrabold">
                <Clock className="w-3.5 h-3.5" /> {fmtTime(elapsed)}
              </div>
              {build.status === 'building' && (
                <div className="flex items-center justify-end gap-1 text-[10px] font-bold mt-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> LIVE
                </div>
              )}
            </div>
          </div>

          {/* Steps */}
          <div className="mt-6 flex items-start">
            {STEPS.map((s, i) => {
              const done = build.status === 'success' || (activeStep > i && ['success'].includes(build.status)) || (build.status === 'building' && i < activeStep)
              const current = build.status === 'building' && i === activeStep
              return (
                <div key={s} className="flex-1 flex flex-col items-center relative">
                  {i > 0 && <div className={`absolute top-4 right-1/2 w-full h-0.5 ${done || current || (build.status === 'success') ? 'bg-white/70' : 'bg-white/25'}`} style={{ right: '50%', width: '100%' }} />}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center relative z-10 text-xs font-extrabold ${
                      done ? 'bg-white text-emerald-600' : current ? 'bg-white text-slate-900' : 'bg-white/20 text-white/80 border border-white/40'
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : current ? <Loader2 className="w-4 h-4 animate-spin" /> : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-bold ${done || current ? 'text-white' : 'text-white/70'}`}>{s}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Terminal */}
        <section className="rounded-2xl bg-[#0d1220] shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-400 text-xs font-mono ml-2 flex-1 truncate">{build.provider === 'github' ? 'GitHub Actions — build output' : 'ApkForge Builder — build output'}</span>
            <button onClick={() => setLogsOpen(!logsOpen)} className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/5 rounded-full px-3 py-1.5 hover:bg-white/10">
              {logsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {logsOpen ? 'Hide' : 'Show'}
            </button>
            <button onClick={copyLogs} className="flex items-center gap-1 text-[11px] font-bold text-slate-300 bg-white/5 rounded-full px-3 py-1.5 hover:bg-white/10">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
          {logsOpen && (
            <div ref={termRef} className="p-4 h-52 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-300/90 whitespace-pre-wrap break-all">
              {build.logs || 'Connecting to render runner...'}
              {build.status === 'building' && <span className="inline-block w-2 h-3.5 bg-violet-400 ml-0.5 animate-pulse align-middle" />}
            </div>
          )}
        </section>

        {/* GitHub run link */}
        {build.provider === 'github' && build.runUrl && (
          <a
            href={build.runUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Github className="w-4 h-4" /> View this build run on GitHub <ExternalLink className="w-3.5 h-3.5 ml-auto text-slate-400" />
          </a>
        )}

        {/* Error detail */}
        {(build.status === 'failed' || build.status === 'canceled') && (
          <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-700 font-medium">
            {build.error || 'Build failed'} — you can start a new build anytime.
            <button onClick={() => setView('build')} className="block mt-2 text-slate-900 font-bold">
              Start new build →
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {['queued', 'building'].includes(build.status) ? (
            <button onClick={cancelBuild} className="flex-1 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition-colors">
              Cancel Build
            </button>
          ) : (
            <button onClick={() => goBack()} className="flex-1 py-3.5 rounded-2xl bg-white border border-slate-200 font-bold text-slate-700 hover:bg-slate-50">
              Back to Home
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
