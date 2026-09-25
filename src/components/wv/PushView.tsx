'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '@/lib/store'
import { useWvEvent } from '@/lib/realtime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronLeft, Megaphone, Send, Image as ImageIcon, Trash2, Loader2, Users,
  Smartphone, Bell, Code2, Upload, Eye, CheckCircle2, Package,
} from 'lucide-react'
import type { PushAppDTO, PushItemDTO } from '@/lib/types'

function Header() {
  const { goBack } = useApp()
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="flex items-center gap-3 px-4 h-16 max-w-2xl mx-auto">
        <button onClick={() => goBack()} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200" aria-label="Back">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">Push Notifications</h1>
          <p className="text-[11px] text-slate-400 -mt-0.5">Send alerts to your app users</p>
        </div>
      </div>
    </header>
  )
}

export default function PushView() {
  const { showToast } = useApp()
  const [apps, setApps] = useState<PushAppDTO[]>([])
  const [appsLoading, setAppsLoading] = useState(true)
  const [history, setHistory] = useState<PushItemDTO[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [selectedPkg, setSelectedPkg] = useState('')
  const [mode, setMode] = useState<'rich' | 'html'>('rich')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [html, setHtml] = useState('')
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadApps = useCallback(() =>
    fetch('/api/push/apps').then((r) => r.json()).then((d) => {
      const list: PushAppDTO[] = d.apps || []
      setApps(list)
      setSelectedPkg((cur) => (cur && list.some((a) => a.packageName === cur) ? cur : list[0]?.packageName || ''))
      setAppsLoading(false)
    }).catch(() => setAppsLoading(false)), [])

  const loadHistory = useCallback(() =>
    fetch('/api/push/history').then((r) => r.json()).then((d) => {
      setHistory(d.notifications || [])
      setHistoryLoading(false)
    }).catch(() => setHistoryLoading(false)), [])

  useEffect(() => {
    loadApps()
    loadHistory()
  }, [loadApps, loadHistory])

  // Real-time: refresh history when a push is sent from another client
  useWvEvent(['push'], () => {
    loadApps()
    loadHistory()
  })

  const selectedApp = apps.find((a) => a.packageName === selectedPkg)

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (file.size > 2.5 * 1024 * 1024) {
      showToast('Image too large — max 3 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      setUploading(true)
      try {
        const res = await fetch('/api/push/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl: reader.result }),
        })
        const d = await res.json()
        if (res.ok && d.url) {
          setImageUrl(d.url)
          showToast('Image uploaded')
        } else {
          showToast(d.error || 'Upload failed')
        }
      } catch {
        showToast('Upload failed — check your connection')
      } finally {
        setUploading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const send = async () => {
    if (!selectedPkg) {
      showToast('Select an app first')
      return
    }
    const t = title.trim()
    if (!t) {
      showToast('Title is required')
      return
    }
    if (mode === 'rich' && !description.trim() && !imageUrl.trim()) {
      showToast('Add a description or an image')
      return
    }
    if (mode === 'html' && !html.trim()) {
      showToast('Write your custom HTML first')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageName: selectedPkg,
          title: t,
          description: description.trim(),
          imageUrl: mode === 'rich' ? imageUrl.trim() : '',
          html: mode === 'html' ? html.trim() : '',
        }),
      })
      const d = await res.json()
      if (res.ok) {
        showToast('Notification sent to your app users')
        setTitle('')
        setDescription('')
        setImageUrl('')
        setHtml('')
        loadHistory()
        loadApps()
      } else {
        showToast(d.error || 'Could not send the notification')
      }
    } catch {
      showToast('Network error — try again')
    } finally {
      setSending(false)
    }
  }

  const remove = async (id: string) => {
    await fetch(`/api/push/${id}`, { method: 'DELETE' })
    loadHistory()
  }

  const previewDoc = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;font-family:sans-serif">${html}</body></html>`

  return (
    <div className="min-h-dvh bg-slate-50">
      <Header />
      <main className="px-4 pt-5 pb-28 max-w-2xl mx-auto space-y-5">

        {/* App picker */}
        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center"><Package className="w-4 h-4 text-violet-600" /></span>
            <h2 className="font-extrabold text-slate-900 text-sm">Send to app</h2>
          </div>
          {appsLoading ? (
            <div className="space-y-2">
              <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
              <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
            </div>
          ) : apps.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center px-6">
              <Smartphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-extrabold text-slate-700 text-sm">No built apps yet</h3>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">Push Notifications work with apps you have built on ApkForge. Build an APK first — newly built apps will receive notifications automatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {apps.map((a) => {
                const active = a.packageName === selectedPkg
                return (
                  <button
                    key={a.packageName}
                    onClick={() => setSelectedPkg(a.packageName)}
                    className={`w-full text-left rounded-2xl border p-3.5 flex items-center gap-3 transition-all ${active ? 'border-violet-400 bg-violet-50/70 ring-2 ring-violet-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25' : 'bg-slate-100 text-slate-500'}`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">{a.appName}</div>
                      <div className="text-[11px] text-slate-400 font-mono truncate">{a.packageName}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-full shrink-0 ${a.devices > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      <Users className="w-3 h-3" /> {a.devices} device{a.devices === 1 ? '' : 's'}
                    </span>
                  </button>
                )
              })}
              {selectedApp && selectedApp.devices === 0 && (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed">
                  No devices connected yet — install &amp; open your app at least once, then it will appear here.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Composer */}
        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center"><Megaphone className="w-4 h-4 text-sky-600" /></span>
            <h2 className="font-extrabold text-slate-900 text-sm">Compose notification</h2>
          </div>

          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 rounded-2xl p-1.5 mb-4">
            <button onClick={() => setMode('rich')} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'rich' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Bell className="w-4 h-4" /> Rich Alert
            </button>
            <button onClick={() => setMode('html')} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${mode === 'html' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Code2 className="w-4 h-4" /> Custom HTML
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-slate-500 tracking-wider mb-1.5">TITLE *</label>
              <Input placeholder="New update available!" className="h-12 rounded-xl" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
            </div>

            {mode === 'rich' && (
              <>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 tracking-wider mb-1.5">DESCRIPTION</label>
                  <textarea placeholder="Tell your users what is new…" className="w-full h-24 rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-500 tracking-wider mb-1.5">IMAGE (OPTIONAL)</label>
                  <div className="flex gap-2">
                    <Input placeholder="https://example.com/banner.png" className="h-12 rounded-xl flex-1" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} className="h-12 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-2 text-sm font-bold text-slate-700 transition-colors disabled:opacity-60 shrink-0">
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
                    </button>
                    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={pickImage} />
                  </div>
                  {imageUrl && (
                    <div className="mt-3 rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Notification preview" className="w-full max-h-48 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </div>
                  )}
                </div>
              </>
            )}

            {mode === 'html' && (
              <div>
                <label className="block text-[11px] font-black text-slate-500 tracking-wider mb-1.5">CUSTOM HTML</label>
                <textarea
                  placeholder={'<div style="padding:16px;text-align:center">\n  <h2 style="color:#7c3aed">Big Sale!</h2>\n  <p>50% off everything today</p>\n</div>'}
                  className="w-full h-48 rounded-xl border border-slate-200 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  value={html}
                  maxLength={20000}
                  onChange={(e) => setHtml(e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">Shown as a banner inside your app. HTML + inline CSS, scripts are supported by the WebView.</p>
                {html.trim() && (
                  <div className="mt-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 mb-1.5"><Eye className="w-3.5 h-3.5" /> LIVE PREVIEW</div>
                    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                      <iframe sandbox="allow-scripts" srcDoc={previewDoc} title="HTML preview" className="w-full h-48 border-0" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={send}
              disabled={sending || appsLoading || apps.length === 0}
              className="w-full h-14 rounded-2xl bg-gradient-to-r from-sky-500 to-violet-600 hover:from-sky-600 hover:to-violet-700 text-white font-extrabold text-base shadow-xl shadow-sky-500/25 transition-all"
            >
              {sending ? (<><Loader2 className="w-5 h-5 animate-spin" /> Sending…</>) : (<><Send className="w-5 h-5" /> SEND PUSH NOTIFICATION</>)}
            </Button>
          </div>
        </section>

        {/* History */}
        <section>
          <div className="flex items-center justify-between mb-2.5 px-1">
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <Bell className="w-4 h-4 text-slate-400" /> Sent notifications
            </h2>
            {history.length > 0 && <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{history.length} total</span>}
          </div>
          {historyLoading ? (
            <div className="space-y-2.5">
              <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
              <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 py-12 text-center px-8 bg-white/60">
              <Megaphone className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="font-extrabold text-slate-700 text-sm">Nothing sent yet</h3>
              <p className="text-slate-400 text-xs mt-1">Your sent push notifications will appear here with delivery stats.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((n) => (
                <div key={n.id} className="rounded-2xl bg-white border border-slate-200 p-4 flex gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{n.title}</div>
                    {n.description && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{n.description}</div>}
                    {n.html && !n.description && <div className="text-[11px] font-mono text-sky-600 mt-0.5">Custom HTML content</div>}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wide bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full">{n.delivered} delivered</span>
                      <span className="text-[10px] font-mono text-slate-300 truncate max-w-[140px]">{n.packageName}</span>
                    </div>
                  </div>
                  <button onClick={() => remove(n.id)} className="w-8 h-8 rounded-lg hover:bg-rose-50 flex items-center justify-center text-slate-300 hover:text-rose-500 transition-colors shrink-0" aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
