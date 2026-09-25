'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Zap, Globe, Code2, Lock, ChevronDown, Image as ImageIcon, Smartphone, Check, Loader2,
  FileCode2, Play, File as FileIcon, Search,
} from 'lucide-react'
import JSZip from 'jszip'
import type { ProjectDTO, BuildConfig } from '@/lib/types'

interface ToggleDef {
  key: keyof BuildConfig
  label: string
  desc: string
  def?: boolean
}

const BEHAVIORS: ToggleDef[] = [
  { key: 'pushNotifications', label: 'Push Notifications', desc: 'Send alerts from your ApkForge dashboard', def: true },
  { key: 'hideTitleBar', label: 'Hide Title Bar', desc: 'Hide the action bar', def: true },
  { key: 'loadingSpinner', label: 'Loading Spinner', desc: 'Show spinner on page load' },
  { key: 'fullscreen', label: 'Fullscreen', desc: 'Hide the status bar' },
  { key: 'exitConfirmation', label: 'Exit Confirmation', desc: 'Press back twice to exit', def: true },
  { key: 'pullToRefresh', label: 'Pull to Refresh', desc: 'Swipe down to reload' },
  { key: 'pinchZoom', label: 'Pinch Zoom', desc: 'Zoom in/out with pinch' },
  { key: 'mediaAutoplay', label: 'Media Autoplay', desc: 'Auto play video & audio' },
  { key: 'autoPlayVideo', label: 'Auto Play Video', desc: 'Muted autoplay for videos' },
  { key: 'desktopMode', label: 'Desktop Mode', desc: 'Desktop user-agent' },
  { key: 'longPressMenu', label: 'Long Press Menu', desc: 'Context menu' },
]

const PERMISSIONS: ToggleDef[] = [
  { key: 'cameraAccess', label: 'Camera Access', desc: 'Camera permission' },
  { key: 'microphone', label: 'Microphone', desc: 'Mic permission' },
]

const APPEARANCE: ToggleDef[] = [{ key: 'darkModeSupport', label: 'Dark Mode Support', desc: 'Auto dark rendering for websites' }]

const TYPE_META: Record<string, { label: string; icon: typeof FileIcon; tint: string }> = {
  kotlin: { label: 'KOTLIN', icon: Play, tint: 'text-fuchsia-600' },
  html: { label: 'HTML', icon: FileCode2, tint: 'text-emerald-600' },
  webview: { label: 'WEBVIEW', icon: Globe, tint: 'text-amber-600' },
  blank: { label: 'BLANK', icon: FileIcon, tint: 'text-slate-500' },
}

function Section({ n, title, children, badge }: { n: number; title: string; children: React.ReactNode; badge?: string }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-4 py-4 bg-slate-50/50 border-b border-slate-100">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white text-sm font-extrabold flex items-center justify-center shadow-sm">{n}</span>
        <span className="font-extrabold text-slate-900 flex-1 text-left">{title}</span>
        {badge && <span className="text-[10px] font-black bg-amber-400 text-white px-2 py-0.5 rounded-full">{badge}</span>}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">{children}{required && ' *'}</label>
}

function ToggleRow({ def, value, onChange }: { def: ToggleDef; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-bold text-slate-800">{def.label}</div>
        <div className="text-[11px] text-slate-400">{def.desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} className="data-[state=checked]:bg-violet-600" />
    </div>
  )
}

function ProjectPicker({ label, emptyHint, projects, selectedId, onSelect }: {
  label: string; emptyHint: string; projects: ProjectDTO[]; selectedId?: string; onSelect: (p: ProjectDTO) => void
}) {
  return (
    <div>
      <FieldLabel required>{label}</FieldLabel>
      {projects.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 mx-auto mb-2 flex items-center justify-center">
            <Search className="w-5 h-5 text-slate-300" />
          </div>
          <div className="text-sm font-bold text-slate-500">{emptyHint}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
          {projects.map((p) => {
            const meta = TYPE_META[p.type] || TYPE_META.blank
            const Icon = meta.icon
            const active = selectedId === p.id
            return (
              <button key={p.id} onClick={() => onSelect(p)} className={`group rounded-xl border-2 p-3 text-left transition-all ${active ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-6 h-6 rounded-lg bg-white ring-1 ring-slate-200 flex items-center justify-center shrink-0">
                    <Icon className={`w-3.5 h-3.5 ${meta.tint}`} />
                  </span>
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">{meta.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-violet-600 ml-auto" />}
                </div>
                <div className="font-bold text-sm text-slate-800 truncate">{p.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{p.fileCount ?? 0} file{(p.fileCount ?? 0) === 1 ? '' : 's'}</div>
              </button>
            )
          })}
        </div>
      )}
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
      if (pre) { setAppName((n) => n || pre.name); setPackageName((p) => p || 'com.apkforge.' + pre.name.toLowerCase().replace(/[^a-z0-9]/g, '')) }
    })
  }, [buildSource?.projectId])

  // Filter projects by tab — HTML shows html/webview/blank, Kotlin shows only kotlin
  const filteredProjects = projects.filter((p) => tab === 'kotlin' ? p.type === 'kotlin' : (p.type === 'html' || p.type === 'webview' || p.type === 'blank'))

  const switchTab = (next: 'html' | 'kotlin') => {
    if (next === tab) return
    setTab(next); setSelectedProject(undefined)
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

  // Build a ZIP from the Kotlin project files client-side
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
      // For Kotlin projects, package project files as ZIP client-side
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
    <div className="pb-32">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16 max-w-3xl mx-auto">
          <button onClick={() => goBack()} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Back">
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-md shadow-violet-600/25">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Build APK</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Convert your project to an Android APK</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4 space-y-4 max-w-3xl mx-auto">
        {/* Source type tabs */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100">
          <button onClick={() => switchTab('html')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${tab === 'html' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25' : 'text-slate-500 hover:text-slate-700'}`}>
            <Globe className="w-4 h-4" /> HTML / CSS / JS
          </button>
          <button onClick={() => switchTab('kotlin')} className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all ${tab === 'kotlin' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25' : 'text-slate-500 hover:text-slate-700'}`}>
            <Code2 className="w-4 h-4" /> Kotlin / Java
          </button>
        </div>

        {/* 1. App info */}
        <Section n={1} title="App Information">
          <div>
            <FieldLabel required>APP NAME</FieldLabel>
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="My Awesome App" className="h-12 rounded-xl focus-visible:ring-violet-500/30" />
          </div>
          <div>
            <FieldLabel required>PACKAGE NAME</FieldLabel>
            <Input value={packageName} onChange={(e) => setPackageName(e.target.value.toLowerCase())} placeholder="com.myapp.main" className="h-12 rounded-xl font-mono text-sm focus-visible:ring-violet-500/30" />
            <p className="text-[10px] text-slate-400 mt-1">Lowercase, dots separated — e.g. com.zarif.calc</p>
          </div>

          {tab === 'html' && (
            <div>
              <FieldLabel>APP SOURCE</FieldLabel>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100">
                <button onClick={() => setSourceMode('url')} className={`py-2.5 rounded-lg text-xs font-bold transition-all ${sourceMode === 'url' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm' : 'text-slate-500'}`}>Website URL</button>
                <button onClick={() => setSourceMode('project')} className={`py-2.5 rounded-lg text-xs font-bold transition-all ${sourceMode === 'project' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-sm' : 'text-slate-500'}`}>My Projects</button>
              </div>
            </div>
          )}

          {tab === 'html' && sourceMode === 'url' && (
            <div>
              <FieldLabel required>WEBSITE URL</FieldLabel>
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
                setSelectedProject(p.id); setAppName((n) => n || p.name)
                setPackageName((pp) => pp || 'com.apkforge.' + p.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
              }}
            />
          )}

          {/* Kotlin: show project picker instead of ZIP upload */}
          {tab === 'kotlin' && (
            <ProjectPicker
              label="SELECT KOTLIN / JAVA PROJECT"
              emptyHint="No Kotlin/Java projects yet — create one from Home first (New Project → Kotlin/Java)"
              projects={filteredProjects}
              selectedId={selectedProject}
              onSelect={(p) => {
                setSelectedProject(p.id); setAppName((n) => n || p.name)
                setPackageName((pp) => pp || 'com.apkforge.' + p.name.toLowerCase().replace(/[^a-z0-9]/g, ''))
              }}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>VERSION NAME</FieldLabel>
              <Input value={versionName} onChange={(e) => setVersionName(e.target.value)} className="h-12 rounded-xl" />
            </div>
            <div>
              <FieldLabel>VERSION CODE</FieldLabel>
              <Input value={versionCode} onChange={(e) => setVersionCode(e.target.value.replace(/\D/g, ''))} className="h-12 rounded-xl" inputMode="numeric" />
            </div>
          </div>
        </Section>

        {/* 2. Branding (both tabs) */}
        <Section n={2} title="Icon & Branding">
          <div className="grid grid-cols-2 gap-3">
            <label className="rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={pickImage(setIcon)} />
              {icon ? <img src={icon} alt="App icon" className="w-12 h-12 rounded-xl object-cover" /> : <ImageIcon className="w-8 h-8 text-slate-300" />}
              <span className="text-xs font-bold text-slate-600">App Icon</span>
              <span className="text-[10px] text-slate-400">512×512 PNG</span>
            </label>
            <label className="rounded-2xl border border-slate-200 p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
              <input type="file" accept="image/*" className="hidden" onChange={pickImage(setSplash)} />
              {splash ? <img src={splash} alt="Splash screen" className="w-12 h-12 rounded-xl object-cover" /> : <Smartphone className="w-8 h-8 text-slate-300" />}
              <span className="text-xs font-bold text-slate-600">Splash Screen</span>
              <span className="text-[10px] text-slate-400">1080×1920</span>
            </label>
          </div>
          <div>
            <FieldLabel>STATUS BAR COLOR</FieldLabel>
            <div className="flex items-center gap-3">
              <input type="color" value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer" />
              <Input value={statusColor} onChange={(e) => setStatusColor(e.target.value)} className="h-12 rounded-xl flex-1 font-mono text-sm" />
            </div>
          </div>
        </Section>

        {tab === 'html' && (
          <Section n={3} title="Behavior & Permissions">
            <FieldLabel>APP BEHAVIOR</FieldLabel>
            <div className="divide-y divide-slate-50 -my-1">{BEHAVIORS.map((b) => <ToggleRow key={b.key} def={b} value={Boolean(config[b.key])} onChange={(v) => setConfig((c) => ({ ...c, [b.key]: v }))} />)}</div>
            <FieldLabel>PERMISSIONS</FieldLabel>
            <div className="divide-y divide-slate-50 -my-1">{PERMISSIONS.map((b) => <ToggleRow key={b.key} def={b} value={Boolean(config[b.key])} onChange={(v) => setConfig((c) => ({ ...c, [b.key]: v }))} />)}</div>
            <FieldLabel>APPEARANCE</FieldLabel>
            <div className="-my-1">{APPEARANCE.map((b) => <ToggleRow key={b.key} def={b} value={Boolean(config[b.key])} onChange={(v) => setConfig((c) => ({ ...c, [b.key]: v }))} />)}</div>
          </Section>
        )}

        <Section n={tab === 'html' ? 4 : 3} title="Pro Features" badge="PRO">
          <div className="flex items-center gap-3 opacity-60">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><Lock className="w-4 h-4 text-slate-400" /></div>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-700">OneSignal Push, AdMob & more</div>
              <div className="text-[11px] text-slate-400">Upgrade to Pro plan to unlock advanced features</div>
            </div>
            <Button size="sm" onClick={() => showToast('Upgrade from More → Subscription')} className="rounded-full bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold">Upgrade</Button>
          </div>
        </Section>

        <Section n={tab === 'html' ? 5 : 4} title="Share & Rate" badge="Optional">
          <div>
            <FieldLabel>SHARE PHRASE</FieldLabel>
            <Input placeholder="Check out this app!" className="h-12 rounded-xl" value={config.sharePhrase || ''} onChange={(e) => setConfig((c) => ({ ...c, sharePhrase: e.target.value }))} />
          </div>
          <div>
            <FieldLabel>SHARE LINK (OPTIONAL)</FieldLabel>
            <Input placeholder="https://play.google.com/store/apps/details?id=..." className="h-12 rounded-xl" value={config.shareLink || ''} onChange={(e) => setConfig((c) => ({ ...c, shareLink: e.target.value }))} />
          </div>
        </Section>

        <Section n={tab === 'html' ? 6 : 5} title="Advanced / Developer" badge="Optional">
          <div>
            <FieldLabel>CUSTOM CSS / JS</FieldLabel>
            <textarea value={config.customCss || ''} onChange={(e) => setConfig((c) => ({ ...c, customCss: e.target.value }))} placeholder="/* Injected into every WebView page */" className="w-full h-24 rounded-xl border border-slate-200 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
          </div>
          <div>
            <FieldLabel>WEBHOOK URL</FieldLabel>
            <Input placeholder="https://hooks.yourserver.com/..." className="h-12 rounded-xl" value={config.webhookUrl || ''} onChange={(e) => setConfig((c) => ({ ...c, webhookUrl: e.target.value }))} />
          </div>
        </Section>

        {/* Summary */}
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/25 overflow-hidden">
              {icon ? <img src={icon} alt="" className="w-full h-full object-cover" /> : <Code2 className="w-9 h-9 text-white" />}
            </div>
            <div className="font-extrabold text-lg text-slate-900 mt-3">{appName || 'Your App'}</div>
            <div className="text-xs text-slate-400 font-mono">{packageName || 'com.myapp.main'}</div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 mt-5 text-center">
            <div><div className="font-extrabold text-slate-900">{versionName || '1.0'}</div><div className="text-[10px] text-slate-400 uppercase tracking-wide">Version</div></div>
            <div><div className="font-extrabold text-slate-900">Android 5+</div><div className="text-[10px] text-slate-400 uppercase tracking-wide">Min SDK</div></div>
            <div><div className="font-extrabold text-slate-900">{tab === 'kotlin' ? 'Kotlin/Java' : 'HTML/CSS/JS'}</div><div className="text-[10px] text-slate-400 uppercase tracking-wide">Source</div></div>
          </div>
        </div>

        {error && <div className="text-rose-600 text-sm bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 font-medium">{error}</div>}
      </main>

      {/* Sticky build button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent z-30">
        <div className="max-w-3xl mx-auto">
          <Button onClick={startBuild} disabled={building} className="w-full h-14 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-extrabold text-base shadow-xl shadow-violet-600/30 transition-all">
            {building ? (<><Loader2 className="w-5 h-5 animate-spin" /> {preparingZip ? 'Packaging project files…' : 'Starting build...'}</>) : (<><Zap className="w-5 h-5 fill-white" /> BUILD APK</>)}
          </Button>
        </div>
      </div>
    </div>
  )
}
