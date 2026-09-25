'use client'

import BrandMark from '@/components/wv/BrandMark'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { useWvEvent } from '@/lib/realtime'
import {
  Plus, Zap, LayoutGrid, Upload, Folder, Download, CreditCard, Star,
  ChevronRight, Clock, Trash2, Pencil, Hammer, FileCode2, Globe, Play, File,
  Smartphone, Bell, X, Activity, TrendingUp, ArrowUpRight, Layers, Tag,
} from 'lucide-react'
import type { ProjectDTO, StatsDTO, BuildDTO } from '@/lib/types'

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const typeMeta: Record<string, { label: string; icon: typeof File; thumb: string; badge: string; tint: string }> = {
  kotlin: { label: 'KOTLIN', icon: Play, thumb: 'from-violet-100 via-white to-fuchsia-50/40', badge: 'bg-gradient-to-br from-violet-500 to-purple-600', tint: 'text-violet-600' },
  html: { label: 'HTML', icon: FileCode2, thumb: 'from-emerald-100 via-white to-teal-50/40', badge: 'bg-gradient-to-br from-emerald-500 to-teal-600', tint: 'text-emerald-600' },
  webview: { label: 'WEBVIEW', icon: Globe, thumb: 'from-amber-100 via-white to-orange-50/40', badge: 'bg-gradient-to-br from-amber-500 to-orange-600', tint: 'text-amber-600' },
  blank: { label: 'BLANK', icon: File, thumb: 'from-slate-100 via-white to-slate-50/40', badge: 'bg-gradient-to-br from-slate-500 to-slate-700', tint: 'text-slate-500' },
}

const buildStatusMeta: Record<string, { label: string; chip: string; dot: string; bar: string }> = {
  queued: { label: 'Queued', chip: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-300' },
  building: { label: 'Building', chip: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-500 animate-pulse', bar: 'bg-gradient-to-r from-amber-400 to-orange-500' },
  success: { label: 'Ready', chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
  failed: { label: 'Failed', chip: 'bg-rose-50 text-rose-600 border border-rose-200', dot: 'bg-rose-500', bar: 'bg-rose-500' },
  canceled: { label: 'Canceled', chip: 'bg-slate-100 text-slate-500 border border-slate-200', dot: 'bg-slate-400', bar: 'bg-slate-300' },
}

export default function HomeView() {
  const { user, setShowNewProject, openEditor, openBuild, setView, showToast, openConsole, openReady, setShowMore } = useApp()
  const [projects, setProjects] = useState<ProjectDTO[]>([])
  const [stats, setStats] = useState<StatsDTO | null>(null)
  const [builds, setBuilds] = useState<BuildDTO[]>([])
  const [buildsLoading, setBuildsLoading] = useState(true)
  const [unread, setUnread] = useState(0)
  const [seeAll, setSeeAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [greeting] = useState(() => {
    if (typeof window === 'undefined') return 'Welcome back'
    const h = new Date().getHours()
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  })

  const load = async () => {
    try {
      const [pRes, sRes] = await Promise.all([fetch('/api/projects'), fetch('/api/stats')])
      const p = await pRes.json()
      const s = await sRes.json()
      setProjects(p.projects || [])
      setStats(s.stats)
    } catch {}
    setLoading(false)
  }

  const loadBuilds = async () => {
    try {
      const res = await fetch('/api/builds')
      const d = await res.json()
      setBuilds(d.builds || [])
    } catch {}
    setBuildsLoading(false)
  }

  const loadUnread = async () => {
    try {
      const res = await fetch('/api/notifications')
      const d = await res.json()
      setUnread(d.unread || 0)
    } catch {}
  }

  useEffect(() => {
    let ok = true
    Promise.all([fetch('/api/projects'), fetch('/api/stats'), fetch('/api/builds'), fetch('/api/notifications')])
      .then(async ([pRes, sRes, bRes, nRes]) => [await pRes.json(), await sRes.json(), await bRes.json(), await nRes.json()] as [
        { projects: ProjectDTO[] },
        { stats: StatsDTO },
        { builds: BuildDTO[] },
        { unread: number },
      ])
      .then(([p, s, b, n]) => {
        if (!ok) return
        setProjects(p.projects || [])
        setStats(s.stats)
        setBuilds(b.builds || [])
        setBuildsLoading(false)
        setUnread(n.unread || 0)
        setLoading(false)
      })
      .catch(() => {
        if (ok) {
          setLoading(false)
          setBuildsLoading(false)
        }
      })
    return () => { ok = false }
  }, [])

  useWvEvent(['projects', 'builds', 'wallet', 'templates', 'user', 'notifications', 'marketplace'], (ev) => {
    load()
    if (ev.type === 'builds' || ev.type === 'user') loadBuilds()
    if (ev.type === 'user' || ev.type === 'notifications') loadUnread()
  })

  const removeProject = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setProjects((ps) => ps.filter((p) => p.id !== id))
    showToast('Project deleted')
  }

  const openBuildResult = (b: BuildDTO) => {
    if (b.status === 'success') openReady(b)
    else openConsole(b)
  }

  const visible = seeAll ? projects : projects.slice(0, 3)
  const firstName = (user?.name || '').split(' ')[0]?.toUpperCase() || 'BUILDER'

  const successCount = builds.filter((b) => b.status === 'success').length
  const buildingCount = builds.filter((b) => b.status === 'building' || b.status === 'queued').length

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 flex items-center gap-2.5 h-16">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white shadow-md shadow-slate-900/20 shrink-0 ring-1 ring-slate-900/5">
            <BrandMark className="w-5 h-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900">APKFORGE</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
          <div className="flex-1" />
          <button onClick={() => setView('notifications')} aria-label="Notifications" className="relative w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
            <Bell className="w-5 h-5" />
            {unread > 0 && <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-extrabold flex items-center justify-center shadow-sm ring-2 ring-white">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button onClick={() => setShowMore(true)} aria-label="Open menu" className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 text-white text-sm font-extrabold flex items-center justify-center shadow-md shadow-violet-500/30 hover:shadow-lg hover:scale-105 transition-all shrink-0">
            {(user?.name || 'A').trim()[0]?.toUpperCase() || 'A'}
          </button>
        </div>
      </header>

      <main className="px-4 pt-6 space-y-8 max-w-5xl mx-auto">
        {/* Hero */}
        <section className="wv-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-5 sm:p-7 text-white shadow-xl shadow-slate-900/20">
          <div className="absolute -right-10 -top-12 w-44 h-44 rounded-full bg-violet-500/25 blur-2xl" />
          <div className="absolute right-24 -bottom-10 w-28 h-28 rounded-full bg-fuchsia-400/20 blur-xl" />
          <svg className="absolute inset-0 w-full h-full opacity-[0.08]" aria-hidden="true">
            <defs><pattern id="forge-grid" width="26" height="26" patternUnits="userSpaceOnUse"><path d="M26 0H0v26" fill="none" stroke="white" strokeWidth="1" /></pattern></defs>
            <rect width="100%" height="100%" fill="url(#forge-grid)" />
          </svg>
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase text-blue-50">
                  <Zap className="w-3 h-3 text-amber-300" /> {user?.plan || 'Free'} plan
                </span>
                {buildingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-400/15 border border-amber-300/30 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase text-amber-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> {buildingCount} building
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-3">{greeting}, {firstName}</h1>
              <p className="text-blue-100/90 text-sm mt-1.5 max-w-md">Turn any idea into a signed Android APK — right from your browser.</p>
            </div>
            <div className="relative grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap lg:justify-end">
              <button onClick={() => setShowNewProject(true)} className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 bg-white text-slate-900 font-extrabold text-sm px-5 py-3 rounded-2xl hover:scale-[1.02] active:scale-95 transition-transform shadow-lg shadow-slate-950/30">
                <Plus className="w-4 h-4" /> New Project
              </button>
              <button onClick={() => openBuild({ type: 'html' })} className="flex items-center justify-center gap-1.5 bg-white/12 border border-white/20 backdrop-blur font-semibold text-sm px-4 py-3 rounded-2xl hover:bg-white/20 transition-colors">
                <Zap className="w-4 h-4" /> Build APK
              </button>
              <button onClick={() => setView('store')} className="flex items-center justify-center gap-1.5 bg-white/12 border border-white/20 backdrop-blur font-semibold text-sm px-4 py-3 rounded-2xl hover:bg-white/20 transition-colors">
                <LayoutGrid className="w-4 h-4" /> Store
              </button>
              <button onClick={() => setView('seller')} className="flex items-center justify-center gap-1.5 bg-white/12 border border-white/20 backdrop-blur font-semibold text-sm px-4 py-3 rounded-2xl hover:bg-white/20 transition-colors">
                <Tag className="w-4 h-4 text-amber-300" /> Sell
              </button>
              <ImportButton onImported={load} showToast={showToast} />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="wv-fade-up grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ animationDelay: '60ms' }}>
          <StatCard icon={Folder} bg="bg-violet-50" color="text-violet-600" ring="ring-violet-100" value={stats ? String(stats.projects) : '—'} label="My Projects" hint="total created" trend={projects.length > 0 ? `${projects.length} active` : 'get started'} onClick={() => setSeeAll(true)} />
          <StatCard icon={Download} bg="bg-emerald-50" color="text-emerald-600" ring="ring-emerald-100" value={stats ? String(stats.downloads) : '—'} label="Downloads" hint="APK installs" trend={successCount > 0 ? `${successCount} ready` : 'no builds yet'} />
          <StatCard icon={CreditCard} bg="bg-amber-50" color="text-amber-600" ring="ring-amber-100" value={stats ? `৳${stats.wallet}` : '—'} label="Wallet" hint="current balance" trend="top up to build" onClick={() => setView('wallet')} />
          <StatCard icon={Star} bg="bg-fuchsia-50" color="text-fuchsia-600" ring="ring-fuchsia-100" value={stats?.plan || 'Free'} label="Plan" hint="subscription" trend={stats?.plan === 'Pro' ? 'all features' : 'upgrade for more'} onClick={() => setView('subscription')} />
        </section>

        {/* Recent builds */}
        <section className="wv-fade-up" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900">
              <span className="inline-flex w-7 h-7 rounded-lg bg-violet-50 items-center justify-center"><Activity className="w-4 h-4 text-violet-600" /></span>
              Recent Builds
            </h2>
            {builds.length > 0 && <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider tabular-nums">{builds.length} total</span>}
          </div>
          {buildsLoading ? (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
              {[0, 1].map((i) => (<div key={i} className="h-16 px-4 flex items-center gap-3 animate-pulse"><div className="w-14 h-6 rounded-full bg-slate-100" /><div className="flex-1 h-4 rounded bg-slate-100 max-w-[180px]" /></div>))}
            </div>
          ) : builds.length === 0 ? (
            <button onClick={() => openBuild({ type: 'html' })} className="group w-full rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center gap-2 text-slate-400 hover:border-violet-300 hover:text-violet-500 transition-colors">
              <Hammer className="w-6 h-6" />
              <span className="text-sm font-bold">No builds yet — forge your first APK</span>
            </button>
          ) : (
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              {builds.slice(0, 4).map((b, idx) => {
                const meta = buildStatusMeta[b.status] || buildStatusMeta.queued
                const isBuilding = b.status === 'building' || b.status === 'queued'
                return (
                  <button key={b.id} onClick={() => openBuildResult(b)} className={`group w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50/80 active:bg-slate-100 transition-colors ${idx !== Math.min(builds.length, 4) - 1 ? 'border-b border-slate-50' : ''}`}>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-wide uppercase px-2.5 py-1 rounded-full shrink-0 ${meta.chip}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-sm text-slate-900 truncate">{b.appName}</span>
                      <span className="block text-[11px] text-slate-400 truncate tabular-nums">v{b.versionName} · {b.versionCode} · {b.apkSize || '—'} · {timeAgo(b.createdAt)}</span>
                      {isBuilding && (<div className="mt-1.5 h-1 w-full max-w-[180px] rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${meta.bar} transition-all duration-500`} style={{ width: `${b.status === 'building' ? Math.max(15, b.progress || 30) : 8}%` }} /></div>)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* App download promo */}
        <section className="wv-fade-up" style={{ animationDelay: '180ms' }}>
          <button onClick={() => setView('appDownload')} className="group w-full rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-violet-700 p-5 sm:p-6 flex items-center gap-4 text-left hover:shadow-2xl hover:shadow-emerald-600/25 active:scale-[0.99] transition-all shadow-lg shadow-emerald-700/20 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40">
            <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full bg-white/20 blur-3xl group-hover:bg-white/30 transition-colors" />
            <div className="relative w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shrink-0 shadow-lg ring-1 ring-white/10">
              <BrandMark className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0 relative">
              <div className="font-extrabold text-white text-sm sm:text-base">Get the Android App</div>
              <div className="text-[11px] sm:text-xs text-emerald-50/90 leading-snug mt-0.5">Native, fast &amp; free — build APKs on the go</div>
            </div>
            <span className="relative flex items-center gap-1.5 bg-white text-emerald-700 rounded-full pl-3.5 pr-4 py-2 text-xs font-extrabold shrink-0 group-hover:scale-105 transition-transform"><Smartphone className="w-3.5 h-3.5" /> GET</span>
          </button>
        </section>

        {/* My Projects */}
        <section className="wv-fade-up" style={{ animationDelay: '240ms' }}>
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900">
              <span className="inline-flex w-7 h-7 rounded-lg bg-emerald-50 items-center justify-center"><Layers className="w-4 h-4 text-emerald-600" /></span>
              My Projects
              {!loading && projects.length > 0 && <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full tabular-nums">{projects.length}</span>}
            </h2>
            {projects.length > 3 && (
              <button onClick={() => setSeeAll(!seeAll)} className="flex items-center gap-0.5 text-violet-600 text-sm font-bold hover:text-violet-700 transition-colors rounded-full px-2 py-1">
                {seeAll ? 'Show less' : 'See all'} <ChevronRight className={`w-4 h-4 transition-transform ${seeAll ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{[0, 1, 2, 3].map((i) => (<div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse" />))}</div>
          ) : projects.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 flex items-center justify-center ring-1 ring-violet-100"><Folder className="w-7 h-7 text-violet-500" /></div>
              <div><div className="text-sm font-extrabold text-slate-700">No projects yet</div><div className="text-xs text-slate-400 mt-1 max-w-xs">Create your first project or pick a template to get started.</div></div>
              <button onClick={() => setShowNewProject(true)} className="mt-1 inline-flex items-center gap-1.5 bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:shadow-lg hover:shadow-violet-500/30 active:scale-95 transition-all"><Plus className="w-4 h-4" /> New Project</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <button onClick={() => setShowNewProject(true)} className="group min-h-44 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-violet-400 hover:text-violet-500 hover:bg-violet-50/40 transition-all">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-violet-100 flex items-center justify-center transition-colors"><Plus className="w-5 h-5" /></div>
                <span className="font-semibold text-sm">New Project</span>
              </button>
              {visible.map((p) => {
                const meta = typeMeta[p.type] || typeMeta.blank
                const Icon = meta.icon
                return (
                  <div key={p.id} className="group rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-slate-900/5 hover:-translate-y-0.5 hover:border-slate-200 transition-all overflow-hidden flex flex-col">
                    <div className={`relative h-24 flex items-center justify-center bg-gradient-to-br ${meta.thumb}`}>
                      <span className={`absolute top-2 right-2 text-[9px] font-extrabold tracking-wider text-white px-2 py-0.5 rounded-md ${meta.badge}`}>{meta.label}</span>
                      <Icon className={`w-10 h-10 ${meta.tint} opacity-70 transition-transform duration-300 group-hover:scale-110`} />
                      <span className="absolute bottom-1.5 right-1.5 text-[9px] font-semibold text-slate-500 bg-white/80 backdrop-blur px-1.5 py-0.5 rounded tabular-nums">{p.fileCount ?? 0} files</span>
                    </div>
                    <div className="p-3.5 flex-1 flex flex-col">
                      <div className="font-bold text-sm text-slate-900 truncate">{p.name}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5"><Clock className="w-3 h-3" /> {timeAgo(p.updatedAt)}</div>
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        <button onClick={() => openEditor({ ...p })} aria-label={`Edit ${p.name}`} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"><Pencil className="w-3 h-3" /> Edit</button>
                        <button onClick={() => openBuild(p.type === 'kotlin' ? { type: 'kotlin', projectId: p.id } : { type: 'html', projectId: p.id })} aria-label={`Build ${p.name}`} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-violet-50 text-[11px] font-bold text-violet-600 hover:bg-violet-100 active:scale-95 transition-all"><Hammer className="w-3 h-3" /> Build</button>
                        <button onClick={() => removeProject(p.id, p.name)} aria-label={`Delete ${p.name}`} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-rose-50 text-[11px] font-bold text-rose-500 hover:bg-rose-100 active:scale-95 transition-all"><Trash2 className="w-3 h-3" /> Del</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function StatCard({ icon: Icon, bg, color, ring, value, label, hint, trend, onClick }: { icon: typeof Folder; bg: string; color: string; ring: string; value: string; label: string; hint: string; trend?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`group relative flex flex-col gap-2.5 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:shadow-slate-900/5 hover:-translate-y-0.5 hover:border-slate-200 p-4 text-left transition-all overflow-hidden ${onClick ? '' : 'cursor-default'}`}>
      <div className={`absolute -top-6 -right-6 w-16 h-16 rounded-full ${bg} opacity-50 group-hover:scale-150 transition-transform duration-500`} />
      <div className={`relative w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0 ring-1 ${ring}`}><Icon className={`w-5 h-5 ${color}`} /></div>
      <div className="relative min-w-0">
        <div className="font-extrabold text-2xl text-slate-900 leading-tight truncate tabular-nums tracking-tight">{value}</div>
        <div className="text-xs text-slate-600 font-bold mt-0.5">{label}</div>
        {trend && <div className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5 opacity-70" /> {trend}</div>}
      </div>
      {onClick && <ArrowUpRight className="absolute top-3 right-3 w-3.5 h-3.5 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />}
    </button>
  )
}

function ImportButton({ showToast: _showToast }: { onImported: () => void; showToast: (s: string) => void }) {
  const { setShowNewProject } = useApp()
  return (
    <button onClick={() => setShowNewProject(true)} className="flex items-center justify-center gap-1.5 bg-white/12 border border-white/20 backdrop-blur font-semibold text-sm px-4 py-3 rounded-2xl hover:bg-white/20 transition-colors" aria-label="Import project">
      <Upload className="w-4 h-4 text-emerald-300" /> <span className="text-emerald-50">Import</span>
    </button>
  )
}
