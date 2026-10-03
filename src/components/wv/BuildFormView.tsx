'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Zap, Globe, Code2, Lock, ChevronDown, ChevronLeft, Image as ImageIcon, Smartphone, Check, Loader2,
  FileCode2, Play, File as FileIcon, Search, Sparkles, Palette, ShieldCheck, Share2, Terminal,
  Package, Fingerprint, Wand2, Rocket, X,
} from 'lucide-react'
import JSZip from 'jszip'
import type { ProjectDTO, BuildConfig } from '@/lib/types'

interface ToggleDef {
  key: keyof BuildConfig
  label: string
  desc: string
  def?: boolean
  icon?: typeof Zap
}

const BEHAVIORS: ToggleDef[] = [
  { key: 'pushNotifications', label: 'Push Notifications', desc: 'Send alerts from your ApkForge dashboard', def: true, icon: Zap },
  { key: 'hideTitleBar', label: 'Hide Title Bar', desc: 'Hide the action bar for a cleaner look', def: true, icon: Smartphone },
  { key: 'loadingSpinner', label: 'Loading Spinner', desc: 'Show spinner while pages load', icon: Loader2 },
  { key: 'fullscreen', label: 'Fullscreen', desc: 'Hide the status bar completely', icon: Smartphone },
  { key: 'exitConfirmation', label: 'Exit Confirmation', desc: 'Press back twice to exit the app', def: true, icon: Check },
  { key: 'pullToRefresh', label: 'Pull to Refresh', desc: 'Swipe down to reload the page', icon: ChevronDown },
  { key: 'pinchZoom', label: 'Pinch Zoom', desc: 'Zoom in/out with pinch gesture', icon: Search },
  { key: 'mediaAutoplay', label: 'Media Autoplay', desc: 'Auto play video & audio on load', icon: Play },
  { key: 'autoPlayVideo', label: 'Auto Play Video', desc: 'Muted autoplay for videos', icon: Play },
  { key: 'desktopMode', label: 'Desktop Mode', desc: 'Use desktop user-agent', icon: Code2 },
  { key: 'longPressMenu', label: 'Long Press Menu', desc: 'Show context menu on long press', icon: FileCode2 },
]

const PERMISSIONS: ToggleDef[] = [
  { key: 'cameraAccess', label: 'Camera Access', desc: 'Allow camera permission', icon: ImageIcon },
  { key: 'microphone', label: 'Microphone', desc: 'Allow microphone permission', icon: Smartphone },
]

const APPEARANCE: ToggleDef[] = [
  { key: 'darkModeSupport', label: 'Dark Mode Support', desc: 'Auto dark rendering for websites', icon: Palette },
]

const TYPE_META: Record<string, { label: string; icon: typeof FileIcon; tint: string; bg: string }> = {
  kotlin: { label: 'KOTLIN', icon: Play, tint: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
  html: { label: 'HTML', icon: FileCode2, tint: 'text-emerald-600', bg: 'bg-emerald-50' },
  webview: { label: 'WEBVIEW', icon: Globe, tint: 'text-amber-600', bg: 'bg-amber-50' },
  blank: { label: 'BLANK', icon: FileIcon, tint: 'text-slate-500', bg: 'bg-slate-100' },
}

// ---------- Section wrapper with icon ----------
function Section({ n, title, subtitle, icon: Icon, children, badge }: {
  n: number
  title: string
  subtitle?: string
  icon: typeof Zap
  children: React.ReactNode
  badge?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-3xl bg-white border border-slate-200/70 overflow-hidden shadow-sm shadow-slate-900/[0.03] transition-all hover:shadow-md hover:shadow-slate-900/[0.05]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3.5 px-5 py-4 bg-gradient-to-r from-slate-50/80 to-white border-b border-slate-100 group"
      >
        <span className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white text-sm font-extrabold flex items-center justify-center shadow-md shadow-violet-600/25">
          <Icon className="w-4 h-4" />
        </span>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-900 text-[15px]">{title}</span>
            {badge && (
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${badge === 'PRO' ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && <div className="text-[11px] text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:text-slate-600 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="p-5 space-y-4">{children}</div>}
    </div>
  )
}

function FieldLabel({ children, required, icon: Icon }: { children: React.ReactNode; required?: boolean; icon?: typeof Zap }) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest text-slate-500 mb-2">
      {Icon && <Icon className="w-3 h-3 text-slate-400" />}
      {children}{required && <span className="text-rose-500">*</span>}
    </label>
  )
}

function ToggleRow({ def, value, onChange }: { def: ToggleDef; value: boolean; onChange: (v: boolean) => void }) {
  const Icon = def.icon || Zap
  return (
    <div className={`flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl transition-colors ${value ? 'bg-violet-50/50' : 'hover:bg-slate-50/80'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${value ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold transition-colors ${value ? 'text-slate-900' : 'text-slate-700'}`}>{def.label}</div>
        <div className="text-[11px] text-slate-400">{def.desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} className="data-[state=checked]:bg-violet-600 shrink-0" />
    </div>
  )
}

function ProjectPicker({ label, emptyHint, projects, selectedId, onSelect }: {
  label: string
  emptyHint: string
  projects: ProjectDTO[]
  selectedId?: string
  onSelect: (p: ProjectDTO) => void
}) {
  return (
    <div>
      <FieldLabel required icon={Search}>{label}</FieldLabel>
      {projects.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-slate-50/50 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm mx-auto mb-3 flex items-center justify-center ring-1 ring-slate-100">
            <Search className="w-5 h-5 text-slate-300" />
          </div>
          <div className="text-sm font-bold text-slate-500">{emptyHint}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto p-1 -m-1">
          {projects.map((p) => {
            const meta = TYPE_META[p.type] || TYPE_META.blank
            const Icon = meta.icon
            const active = selectedId === p.id
            return (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className={`group relative rounded-2xl border-2 p-3.5 text-left transition-all overflow-hidden ${active ? 'border-violet-500 bg-violet-50/60 shadow-md shadow-violet-500/10' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/30'}`}
              >
                {active && <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center shadow-sm"><Check className="w-3 h-3 text-white" /></div>}
                <div className={`w-9 h-9 rounded-xl ${meta.bg} ring-1 ring-black/5 flex items-center justify-center mb-2`}>
                  <Icon className={`w-4 h-4 ${meta.tint}`} />
                </div>
                <div className="font-bold text-sm text-slate-800 truncate">{p.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{p.fileCount ?? 0} file{(p.fileCount ?? 0) === 1 ? '' : 's'}</div>
                <div className="text-[9px] font-extrabold text-slate-300 uppercase tracking-wider mt-1">{meta.label}</div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- Live preview phone mockup ----------
function PhonePreview({ appName, packageName, versionName, icon, statusColor, sourceType }: {
  appName: string
  packageName: string
  versionName: string
  icon?: string
  statusColor: string
  sourceType: 'html' | 'kotlin'
}) {
  return (
    <div className="sticky top-24">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-950 p-6 shadow-2xl shadow-slate-900/30 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-32 h-32 rounded-full bg-fuchsia-500/15 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span className="text-[11px] font-bold tracking-widest text-violet-200/80 uppercase">Live Preview</span>
          </div>
          {/* Phone frame */}
          <div className="mx-auto w-44">
            <div className="rounded-[2rem] bg-slate-950 p-1.5 shadow-2xl ring-1 ring-white/10">
              <div className="rounded-[1.6rem] bg-white overflow-hidden relative" style={{ aspectRatio: '9/16' }}>
                {/* Status bar */}
                <div className="h-4 flex items-center justify-center" style={{ background: statusColor || '#7C3AED' }}>
                  <div className="w-12 h-1 rounded-full bg-black/20" />
                </div>
                {/* App content */}
                <div className="flex flex-col items-center justify-center h-[calc(100%-1rem)] p-2 gap-1.5">
                  <div className="w-12 h-12 rounded-2xl shadow-lg overflow-hidden ring-2 ring-white/60" style={{ background: icon ? 'transparent' : 'linear-gradient(135deg, #8b5cf6, #d946ef)' }}>
                    {icon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : <Code2 className="w-6 h-6 text-white m-auto mt-3" />}
                  </div>
                  <div className="text-[10px] font-extrabold text-slate-900 text-center truncate max-w-full">{appName || 'Your App'}</div>
                  <div className="text-[7px] text-slate-400 font-mono truncate max-w-full">{packageName || 'com.myapp.main'}</div>
                  <div className="mt-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[7px] font-bold text-slate-500">v{versionName || '1.0'}</div>
                </div>
              </div>
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-5">
            <div className="text-center rounded-xl bg-white/5 border border-white/10 py-2">
              <div className="text-xs font-extrabold text-white">{versionName || '1.0'}</div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wide">Version</div>
            </div>
            <div className="text-center rounded-xl bg-white/5 border border-white/10 py-2">
              <div className="text-xs font-extrabold text-white">5.0+</div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wide">Min SDK</div>
            </div>
            <div className="text-center rounded-xl bg-white/5 border border-white/10 py-2">
              <div className="text-xs font-extrabold text-white">{sourceType === 'kotlin' ? 'KT' : 'HTML'}</div>
              <div className="text-[8px] text-slate-400 uppercase tracking-wide">Source</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BuildFormView() {
  const { buildSource, openConsole, user, goBack, showToast } = useApp()
  const [tab, setTab] = useState<'html' | 'kotlin'>(buildSource?.type || 'html')
  const [appName, setAppName] = useState('')
  const [packageName, setPackageName] = useState('')
  const [sourceMode, setSourceMode] = useState<'url' | 'project'>(buildSource?.projectId ? 'project' : 'url')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [versionName, setVersionName] = useState('1.0')
  const [versionCode, setVersionCode] = useState('1')
  const [projects, setProjects] = useState<ProjectDTO[]>([])
  const [selectedProject, setSelectedProject] = useState<string | undefined>(buildSource?.projectId)
  const [icon, setIcon] = useState<string | undefined>()
  const [splash, setSplash] = useState<string | undefined>()
  const [statusColor, setStatusColor] = useState('#7C3AED')
  const [config, setConfig] = useState<BuildConfig>({
    pushNotifications: true, hideTitleBar: true, exitConfirmation: true, loadingSpinner: false, fullscreen: false,
    pullToRefresh: false, pinchZoom: false, mediaAutoplay: false, autoPlayVideo: false,
    desktopMode: false, longPressMenu: false, cameraAccess: false, microphone: false, darkModeSupport: false,
  })
  const [preparingZip, setPreparingZip] = useState(false)
  const [building, setBuilding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/projects').then((r) => r.json()).then((d) => {
      setProjects(d.projects || [])
      const pre = (d.projects || []).find((p: ProjectDTO) => p.id === buildSource?.projectId)
      if (pre) {
        setAppName((n) => n || pre.name)
        setPackageName((p) => p || 'com.apkforge.' + pre.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
      }
    })
  }, [buildSource?.projectId])

  const filteredProjects = projects.filter((p) =>
    tab === 'kotlin' ? p.type === 'kotlin' : (p.type === 'html' || p.type === 'webview' || p.type === 'blank')
  )

  const switchTab = (next: 'html' | 'kotlin') => {
    if (next === tab) return
    setTab(next)
    setSelectedProject(undefined)
    if (next === 'kotlin') setSourceMode('project')
  }

  const pickImage = (setter: (v: string | undefined) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1024 * 1024) { showToast('Image too large (max 1 MB)'); return }
    const reader = new FileReader()
    reader.onload = () => setter(reader.result as string)
    reader.readAsDataURL(file)
  }

  const buildKotlinZipFromProject = async (projectId: string): Promise<string> => {
    const res = await fetch(`/api/projects/${projectId}/files`)
    if (!res.ok) throw new Error('Could not load project files')
    const d = await res.json()
    const files: Array<{ path: string; content: string }> = d.files || []
    const zip = new JSZip()
    for (const f of files) { zip.file(f.path.replace(/^\.?\//, ''), f.content) }
    const blob = await zip.generateAsync({ type: 'base64' })
    return `data:application/zip;base64,${blob}`
  }

  const startBuild = async () => {
    setError('')
    if (!appName.trim()) { setError('App name is required'); return }
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(packageName)) { setError('Package name must look like com.myapp.main (lowercase)'); return }
    if (tab === 'html' && sourceMode === 'url' && !/^https?:\/\/.+/.test(websiteUrl)) { setError('Enter a valid website URL starting with https://'); return }
    if (tab === 'html' && sourceMode === 'project' && !selectedProject) { setError('Select one of your HTML/CSS/JS projects'); return }
    if (tab === 'kotlin' && !selectedProject) { setError('Select one of your Kotlin/Java projects'); return }

    setBuilding(true)
    try {
      let zipBase64: string | undefined
      if (tab === 'kotlin' && selectedProject) {
        setPreparingZip(true)
        try { zipBase64 = await buildKotlinZipFromProject(selectedProject) }
        catch { setError('Could not package Kotlin project files — please try again'); setBuilding(false); setPreparingZip(false); return }
        setPreparingZip(false)
      }
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: appName.trim(), packageName, versionName, versionCode: parseInt(versionCode) || 1,
          sourceType: tab, sourceMode: tab === 'kotlin' ? 'zip' : sourceMode,
          websiteUrl: tab === 'html' && sourceMode === 'url' ? websiteUrl : undefined,
          projectId: selectedProject, zipBase64,
          config: { ...config, icon, splash, statusBarColor: statusColor },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to start build'); setBuilding(false); return }
      openConsole(data.build)
    } catch { setError('Network error'); setBuilding(false) }
  }

  return (
    <div className="pb-32 min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16 max-w-6xl mx-auto">
          <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Back">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-600/25">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Build APK</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Convert your project into an installable Android app</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Engine Online
          </div>
        </div>
      </header>

      {/* Hero banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 text-white">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 py-8 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center shrink-0 shadow-lg">
            <Rocket className="w-7 h-7 text-violet-300" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight">Create your Android App</h2>
            <p className="text-sm text-violet-200/80 mt-0.5">Real APK built by GitHub Actions — installable on any Android 5+ device.</p>
          </div>
        </div>
      </div>

      {/* Source type tabs — large cards */}
      <div className="max-w-6xl mx-auto px-4 -mt-4 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => switchTab('html')}
            className={`group relative overflow-hidden rounded-2xl p-4 text-left transition-all border-2 ${tab === 'html' ? 'border-violet-500 bg-white shadow-lg shadow-violet-500/10' : 'border-slate-200 bg-white/70 hover:border-violet-300 hover:bg-white'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${tab === 'html' ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md' : 'bg-emerald-50 text-emerald-600'}`}>
                <Globe className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 text-sm">HTML / CSS / JS</span>
                  {tab === 'html' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">WebView app from website or project</div>
              </div>
            </div>
          </button>
          <button
            onClick={() => switchTab('kotlin')}
            className={`group relative overflow-hidden rounded-2xl p-4 text-left transition-all border-2 ${tab === 'kotlin' ? 'border-violet-500 bg-white shadow-lg shadow-violet-500/10' : 'border-slate-200 bg-white/70 hover:border-violet-300 hover:bg-white'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${tab === 'kotlin' ? 'bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-md' : 'bg-fuchsia-50 text-fuchsia-600'}`}>
                <Code2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-slate-900 text-sm">Kotlin / Java</span>
                  {tab === 'kotlin' && <Check className="w-3.5 h-3.5 text-violet-600" />}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Native Android app from source code</div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Main content + sidebar layout */}
      <main className="max-w-6xl mx-auto px-4 pt-5 grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-4">
          {/* 1. App info */}
          <Section n={1} title="App Information" subtitle="Basic identity of your app" icon={Package}>
            <div>
              <FieldLabel required icon={Smartphone}>APP NAME</FieldLabel>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="My Awesome App" className="h-12 rounded-xl focus-visible:ring-violet-500/30" />
            </div>
            <div>
              <FieldLabel required icon={Fingerprint}>PACKAGE NAME</FieldLabel>
              <Input value={packageName} onChange={(e) => setPackageName(e.target.value.toLowerCase())} placeholder="com.myapp.main" className="h-12 rounded-xl font-mono text-sm focus-visible:ring-violet-500/30" />
              <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" />Lowercase, dots separated — e.g. com.zarif.calc</p>
            </div>

            {tab === 'html' && (
              <div>
                <FieldLabel icon={Code2}>APP SOURCE</FieldLabel>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
                  <button onClick={() => setSourceMode('url')} className={`py-2.5 rounded-lg text-xs font-bold transition-all ${sourceMode === 'url' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <Globe className="w-3 h-3 inline mr-1" /> Website URL
                  </button>
                  <button onClick={() => setSourceMode('project')} className={`py-2.5 rounded-lg text-xs font-bold transition-all ${sourceMode === 'project' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    <FileCode2 className="w-3 h-3 inline mr-1" /> My Projects
                  </button>
                </div>
              </div>
            )}

            {tab === 'html' && sourceMode === 'url' && (
              <div>
                <FieldLabel required icon={Globe}>WEBSITE URL</FieldLabel>
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://my-website.com" className="h-12 rounded-xl focus-visible:ring-violet-500/30" type="url" />
              </div>
            )}

            {tab === 'html' && sourceMode === 'project' && (
              <ProjectPicker
                label="SELECT HTML / CSS / JS PROJECT"
                emptyHint="No HTML/CSS/JS projects yet — create one from Home first"
                projects={filteredProjects}
                selectedId={selectedProject}
                onSelect={(p) => {
                  setSelectedProject(p.id)
                  setAppName((n) => n || p.name)
                  setPackageName((pp) => pp || 'com.apkforge.' + p.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
                }}
              />
            )}

            {tab === 'kotlin' && (
              <ProjectPicker
                label="SELECT KOTLIN / JAVA PROJECT"
                emptyHint="No Kotlin/Java projects yet — create one from Home first"
                projects={filteredProjects}
                selectedId={selectedProject}
                onSelect={(p) => {
                  setSelectedProject(p.id)
                  setAppName((n) => n || p.name)
                  setPackageName((pp) => pp || 'com.apkforge.' + p.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
                }}
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel icon={Wand2}>VERSION NAME</FieldLabel>
                <Input value={versionName} onChange={(e) => setVersionName(e.target.value)} className="h-12 rounded-xl" placeholder="1.0" />
              </div>
              <div>
                <FieldLabel icon={Wand2}>VERSION CODE</FieldLabel>
                <Input value={versionCode} onChange={(e) => setVersionCode(e.target.value.replace(/\D/g, ''))} className="h-12 rounded-xl" inputMode="numeric" placeholder="1" />
              </div>
            </div>
          </Section>

          {/* 2. Branding */}
          <Section n={2} title="Icon & Branding" subtitle="Visual identity of your app" icon={Palette}>
            <div className="grid grid-cols-2 gap-3">
              <label className="group rounded-2xl border-2 border-slate-200 p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all relative overflow-hidden">
                <input type="file" accept="image/*" className="hidden" onChange={pickImage(setIcon)} />
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden transition-all ${icon ? 'ring-2 ring-violet-300 shadow-md' : 'bg-slate-100'}`}>
                  {icon ? <img src={icon} alt="App icon" className="w-full h-full object-cover" /> : <ImageIcon className="w-7 h-7 text-slate-300" />}
                </div>
                <span className="text-xs font-bold text-slate-700">App Icon</span>
                <span className="text-[10px] text-slate-400">512×512 PNG</span>
              </label>
              <label className="group rounded-2xl border-2 border-slate-200 p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-all relative overflow-hidden">
                <input type="file" accept="image/*" className="hidden" onChange={pickImage(setSplash)} />
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden transition-all ${splash ? 'ring-2 ring-violet-300 shadow-md' : 'bg-slate-100'}`}>
                  {splash ? <img src={splash} alt="Splash screen" className="w-full h-full object-cover" /> : <Smartphone className="w-7 h-7 text-slate-300" />}
                </div>
                <span className="text-xs font-bold text-slate-700">Splash Screen</span>
                <span className="text-[10px] text-slate-400">1080×1920</span>
              </label>
            </div>
            <div>
              <FieldLabel icon={Palette}>STATUS BAR COLOR</FieldLabel>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input type="color" value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="w-12 h-12 rounded-xl border-2 border-slate-200 cursor-pointer" />
                </div>
                <Input value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="h-12 rounded-xl flex-1 font-mono text-sm" />
              </div>
              {/* Color swatches */}
              <div className="flex gap-2 mt-2">
                {['#7C3AED', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#0F172A'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setStatusColor(c)}
                    className={`w-7 h-7 rounded-lg ring-2 transition-all ${statusColor === c ? 'ring-slate-900 scale-110' : 'ring-transparent hover:ring-slate-200'}`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </Section>

          {/* 3. Behavior */}
          {tab === 'html' && (
            <Section n={3} title="Behavior & Permissions" subtitle="Control how your app behaves" icon={Smartphone}>
              <div>
                <FieldLabel icon={Zap}>APP BEHAVIOR</FieldLabel>
                <div className="space-y-0.5">{BEHAVIORS.map((b) => (
                  <ToggleRow key={b.key} def={b} value={Boolean(config[b.key])} onChange={(v) => setConfig((c) => ({ ...c, [b.key]: v }))} />
                ))}</div>
              </div>
              <div>
                <FieldLabel icon={Lock}>PERMISSIONS</FieldLabel>
                <div className="space-y-0.5">{PERMISSIONS.map((b) => (
                  <ToggleRow key={b.key} def={b} value={Boolean(config[b.key])} onChange={(v) => setConfig((c) => ({ ...c, [b.key]: v }))} />
                ))}</div>
              </div>
              <div>
                <FieldLabel icon={Palette}>APPEARANCE</FieldLabel>
                <div className="space-y-0.5">{APPEARANCE.map((b) => (
                  <ToggleRow key={b.key} def={b} value={Boolean(config[b.key])} onChange={(v) => setConfig((c) => ({ ...c, [b.key]: v }))} />
                ))}</div>
              </div>
            </Section>
          )}

          {/* 4. Security */}
          <Section n={tab === 'html' ? 4 : 3} title="Security & Pro Features" subtitle="Protect your code with encryption" icon={ShieldCheck} badge="PRO">
            {tab === 'html' && (
              <div className={`rounded-2xl border-2 p-4 transition-all ${config.enableAssetEncryption ? 'border-violet-300 bg-gradient-to-br from-violet-50/60 to-fuchsia-50/40' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${config.enableAssetEncryption ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/30' : 'bg-slate-100 text-slate-400'}`}>
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-extrabold text-slate-900">AES-256 Asset Encryption</span>
                      <span className="text-[9px] font-extrabold bg-gradient-to-r from-amber-400 to-orange-500 text-white px-2 py-0.5 rounded-full">PRO</span>
                    </div>
                    <div className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      Encrypts every HTML/CSS/JS file inside the APK with AES-256-CBC. The WebView decrypts assets at runtime so the source is never stored in plain text — protects your code from APK decompilation.
                    </div>
                    {config.enableAssetEncryption && (
                      <div className="text-[10px] text-violet-700 font-bold mt-2 flex items-center gap-1 bg-violet-100/60 rounded-lg px-2 py-1 inline-flex">
                        <Check className="w-3 h-3" /> Enabled — assets will be encrypted with a per-build key
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={Boolean(config.enableAssetEncryption)}
                    onCheckedChange={(v) => {
                      if (v && user?.plan !== 'Pro') {
                        showToast('AES-256 encryption is a Pro feature — upgrade from More → Subscription')
                        return
                      }
                      setConfig((c) => ({ ...c, enableAssetEncryption: v }))
                    }}
                    className="data-[state=checked]:bg-violet-600 shrink-0 mt-1"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 opacity-60 rounded-2xl border border-dashed border-slate-200 p-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Sparkles className="w-4 h-4 text-slate-400" /></div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-700">OneSignal Push, AdMob & more</div>
                <div className="text-[11px] text-slate-400">Upgrade to Pro plan to unlock advanced features</div>
              </div>
              <Button size="sm" onClick={() => showToast('Upgrade from More → Subscription')} className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white text-xs font-bold">Upgrade</Button>
            </div>
          </Section>

          {/* 5. Share & Rate */}
          <Section n={tab === 'html' ? 5 : 4} title="Share & Rate" subtitle="In-app sharing options" icon={Share2} badge="Optional">
            <div>
              <FieldLabel icon={Share2}>SHARE PHRASE</FieldLabel>
              <Input placeholder="Check out this app!" className="h-12 rounded-xl" value={config.sharePhrase || ''} onChange={(e) => setConfig((c) => ({ ...c, sharePhrase: e.target.value }))} />
            </div>
            <div>
              <FieldLabel icon={Share2}>SHARE LINK (OPTIONAL)</FieldLabel>
              <Input placeholder="https://play.google.com/store/apps/details?id=..." className="h-12 rounded-xl" value={config.shareLink || ''} onChange={(e) => setConfig((c) => ({ ...c, shareLink: e.target.value }))} />
            </div>
          </Section>

          {/* 6. Advanced */}
          <Section n={tab === 'html' ? 6 : 5} title="Advanced / Developer" subtitle="Custom code & webhooks" icon={Terminal} badge="Optional">
            <div>
              <FieldLabel icon={Code2}>CUSTOM CSS / JS</FieldLabel>
              <textarea value={config.customCss || ''} onChange={(e) => setConfig((c) => ({ ...c, customCss: e.target.value }))} placeholder="/* Injected into every WebView page */" className="w-full h-24 rounded-xl border border-slate-200 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30 resize-none" />
            </div>
            <div>
              <FieldLabel icon={Terminal}>WEBHOOK URL</FieldLabel>
              <Input placeholder="https://hooks.yourserver.com/..." className="h-12 rounded-xl" value={config.webhookUrl || ''} onChange={(e) => setConfig((c) => ({ ...c, webhookUrl: e.target.value }))} />
            </div>
          </Section>

          {error && (
            <div className="text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 font-medium flex items-center gap-2">
              <X className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Sidebar — live preview */}
        <div className="hidden lg:block">
          <PhonePreview
            appName={appName}
            packageName={packageName}
            versionName={versionName}
            icon={icon}
            statusColor={statusColor}
            sourceType={tab}
          />
        </div>
      </main>

      {/* Sticky build button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-30">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Ready to build</span>
            <span className="text-sm font-extrabold text-slate-900 truncate max-w-[200px]">{appName || 'Your App'} v{versionName || '1.0'}</span>
          </div>
          <Button
            onClick={startBuild}
            disabled={building}
            className="flex-1 h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-extrabold text-base shadow-xl shadow-violet-600/30 transition-all hover:shadow-2xl hover:shadow-violet-600/40"
          >
            {building ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> {preparingZip ? 'Packaging project files…' : 'Starting build...'}</>
            ) : (
              <><Zap className="w-5 h-5 fill-white" /> BUILD APK</>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
