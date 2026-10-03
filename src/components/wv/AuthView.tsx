'use client'

import BrandMark from '@/components/wv/BrandMark'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useApp } from '@/lib/store'
import { Eye, EyeOff, Loader2, Lock, Mail, User, Zap, Smartphone, Download, Sparkles, ShieldCheck, Rocket } from 'lucide-react'
import type { AppReleaseDTO, SessionUser } from '@/lib/types'

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = size === 'lg' ? 'w-14 h-14 rounded-2xl text-2xl' : size === 'sm' ? 'w-8 h-8 rounded-lg text-sm' : 'w-10 h-10 rounded-xl text-lg'
  const text = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-xl'
  return (
    <div className="flex items-center gap-2.5">
      <div className={`${box} bg-gradient-to-br from-slate-900 to-slate-700 flex items-center justify-center text-white shadow-lg shadow-slate-900/20 border border-white/10`}>
        <BrandMark className="w-[55%] h-[55%]" />
      </div>
      <span className={`${text} font-extrabold tracking-tight text-slate-900`}>APKFORGE</span>
    </div>
  )
}

export default function AuthView({ onAuthed }: { onAuthed: (u: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [referral, setReferral] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [appRelease, setAppRelease] = useState<AppReleaseDTO | null>(null)

  useEffect(() => {
    fetch('/api/app').then((r) => r.json()).then((d) => setAppRelease(d.release || null)).catch(() => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { email, password } : { name, email, password, referral }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); return }
      onAuthed(data.user)
    } catch { setError('Network error. Please try again.') } finally { setLoading(false) }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 relative overflow-hidden">
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-violet-600/30 blur-3xl" />
      <div className="absolute -bottom-40 -left-32 w-96 h-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]" aria-hidden="true">
        <defs><pattern id="auth-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="white" /></pattern></defs>
        <rect width="100%" height="100%" fill="url(#auth-dots)" />
      </svg>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10 relative z-10">
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg"><BrandMark className="w-8 h-8 text-slate-900" /></div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">APKFORGE</h1>
          <p className="text-violet-200/90 text-sm font-medium flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-300" /> Build Android APKs — No Coding Needed</p>
        </div>
        <div className="w-full max-w-sm bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 ring-1 ring-white/20">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-slate-100 mb-6">
            {(['login', 'register'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError('') }} className={`py-2.5 rounded-xl text-sm font-bold transition-all ${mode === m ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25' : 'text-slate-500 hover:text-slate-700'}`}>
                {m === 'login' ? 'Login' : 'Register'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-3.5">
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="pl-10 h-12 rounded-xl border-slate-200 focus-visible:ring-violet-500/30" autoComplete="name" />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="pl-10 h-12 rounded-xl border-slate-200 focus-visible:ring-violet-500/30" autoComplete="email" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 characters)" className="pl-10 pr-10 h-12 rounded-xl border-slate-200 focus-visible:ring-violet-500/30" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
            {mode === 'register' && (
              <div className="relative">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} placeholder="Referral code (optional)" className="pl-10 h-12 rounded-xl border-slate-200 focus-visible:ring-violet-500/30" />
              </div>
            )}
            {error && <div className="text-rose-600 text-sm bg-rose-50 border border-rose-100 rounded-xl px-4 py-2.5 font-medium">{error}</div>}
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-bold text-base shadow-lg shadow-violet-500/30 transition-all hover:shadow-xl hover:shadow-violet-500/40">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : mode === 'login' ? 'Login to ApkForge' : 'Create Account'}
            </Button>
          </form>
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-100">
            <div className="flex flex-col items-center gap-1 text-center"><ShieldCheck className="w-4 h-4 text-emerald-500" /><span className="text-[10px] font-bold text-slate-500">Secure</span></div>
            <div className="flex flex-col items-center gap-1 text-center"><Rocket className="w-4 h-4 text-violet-500" /><span className="text-[10px] font-bold text-slate-500">Fast builds</span></div>
            <div className="flex flex-col items-center gap-1 text-center"><Sparkles className="w-4 h-4 text-amber-500" /><span className="text-[10px] font-bold text-slate-500">No code</span></div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">By continuing you agree to our Terms of Service &amp; Privacy Policy</p>
        </div>
        {appRelease && (
          <a href="/api/app/download" download className="mt-4 w-full max-w-sm flex items-center justify-center gap-2 bg-white/10 border border-white/25 backdrop-blur-md text-white text-sm font-bold rounded-full px-5 py-3 hover:bg-white/20 transition-colors">
            <Smartphone className="w-4 h-4" /> Download our Android App
            <span className="text-[10px] font-extrabold bg-white/20 rounded-full px-2 py-0.5">v{appRelease.versionName}</span>
            <Download className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  )
}
