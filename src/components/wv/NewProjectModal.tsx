'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApp } from '@/lib/store'
import { File, Globe, Code2, Play, X, Plus, Loader2, FileCode2, Sparkles } from 'lucide-react'
import type { ProjectDTO } from '@/lib/types'

const TYPES = [
  { id: 'blank', label: 'Blank', desc: 'Empty project', icon: File, accent: 'violet' },
  { id: 'webview', label: 'WebView', desc: 'Website → App', icon: Globe, accent: 'amber' },
  { id: 'html', label: 'HTML/CSS/JS', desc: 'Custom code', icon: Code2, accent: 'emerald' },
  { id: 'kotlin', label: 'Kotlin/Java', desc: 'Native Android', icon: Play, accent: 'fuchsia' },
] as const

const accentMap: Record<string, { activeBorder: string; activeBg: string; activeIconBg: string; activeIconColor: string; activeLabel: string }> = {
  violet: { activeBorder: 'border-violet-500', activeBg: 'bg-violet-50', activeIconBg: 'bg-violet-100', activeIconColor: 'text-violet-600', activeLabel: 'text-violet-700' },
  amber: { activeBorder: 'border-amber-500', activeBg: 'bg-amber-50', activeIconBg: 'bg-amber-100', activeIconColor: 'text-amber-600', activeLabel: 'text-amber-700' },
  emerald: { activeBorder: 'border-emerald-500', activeBg: 'bg-emerald-50', activeIconBg: 'bg-emerald-100', activeIconColor: 'text-emerald-600', activeLabel: 'text-emerald-700' },
  fuchsia: { activeBorder: 'border-fuchsia-500', activeBg: 'bg-fuchsia-50', activeIconBg: 'bg-fuchsia-100', activeIconColor: 'text-fuchsia-600', activeLabel: 'text-fuchsia-700' },
}

export default function NewProjectModal() {
  const { showNewProject, setShowNewProject, openEditor, showToast } = useApp()
  const [name, setName] = useState('')
  const [type, setType] = useState<'blank' | 'webview' | 'html' | 'kotlin'>('blank')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!showNewProject) return null

  const create = async () => {
    if (name.trim().length < 2) { setError('Project name must be at least 2 characters'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), type }) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create project'); return }
      setShowNewProject(false); setName(''); setType('blank')
      openEditor(data.project as ProjectDTO)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowNewProject(false)} />
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 max-h-[90dvh] overflow-y-auto ring-1 ring-slate-200/50 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-extrabold tracking-widest text-violet-600 uppercase mb-1"><Sparkles className="w-3 h-3" /> Get started</div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Create New Project</h2>
          </div>
          <button onClick={() => setShowNewProject(false)} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>
        <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-2">PROJECT NAME</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Awesome App" className="h-12 rounded-xl border-slate-200 text-base focus-visible:ring-violet-500/30" onKeyDown={(e) => e.key === 'Enter' && create()} />
        <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mt-6 mb-3">START WITH</label>
        <div className="grid grid-cols-2 gap-3">
          {TYPES.map((t) => {
            const Icon = t.id === 'blank' ? File : t.id === 'webview' ? Globe : t.id === 'html' ? FileCode2 : Play
            const active = type === t.id
            const accent = accentMap[t.accent]
            return (
              <button key={t.id} onClick={() => setType(t.id)} className={`group rounded-2xl border-2 p-4 flex flex-col items-center gap-2.5 transition-all ${active ? `${accent.activeBorder} ${accent.activeBg} shadow-sm` : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${active ? `${accent.activeIconBg} ${accent.activeIconColor}` : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}><Icon className="w-6 h-6" /></div>
                <div className="text-center"><div className={`font-bold text-sm ${active ? accent.activeLabel : 'text-slate-800'}`}>{t.label}</div><div className="text-xs text-slate-400 mt-0.5">{t.desc}</div></div>
              </button>
            )
          })}
        </div>
        {error && <div className="mt-4 text-rose-600 text-sm bg-rose-50 border border-rose-100 rounded-xl px-4 py-2.5 font-medium">{error}</div>}
        <Button onClick={create} disabled={loading} className="w-full h-13 mt-6 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold text-base py-3.5 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Plus className="w-5 h-5" /> Create Project</>}
        </Button>
      </div>
    </div>
  )
}
