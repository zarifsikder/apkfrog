'use client'

import { useApp } from '@/lib/store'
import { User, CreditCard, ReceiptText, Star, Users, Bell, LogOut, ChevronRight, X, Wallet, ShieldCheck, Smartphone, Zap, Tag, ShoppingCart, Megaphone } from 'lucide-react'
import type { ViewName } from '@/lib/types'

const MENU: { view: ViewName; label: string; desc: string; icon: typeof User; tile: string; iconColor: string; adminOnly?: boolean }[] = [
  { view: 'seller', label: 'Sell on Store', desc: 'List projects, coupons & sales', icon: Tag, tile: 'bg-amber-50', iconColor: 'text-amber-600' },
  { view: 'purchases', label: 'My Purchases', desc: 'Projects you bought', icon: ShoppingCart, tile: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { view: 'profile', label: 'Profile', desc: 'Account settings', icon: User, tile: 'bg-violet-50', iconColor: 'text-violet-600' },
  { view: 'wallet', label: 'Wallet', desc: 'Balance & transactions', icon: Wallet, tile: 'bg-amber-50', iconColor: 'text-amber-600' },
  { view: 'payments', label: 'My Payments', desc: 'Track pending & past requests', icon: ReceiptText, tile: 'bg-yellow-50', iconColor: 'text-yellow-600' },
  { view: 'subscription', label: 'Subscription', desc: 'Plans & upgrades', icon: Star, tile: 'bg-fuchsia-50', iconColor: 'text-fuchsia-600' },
  { view: 'referrals', label: 'Refer & Earn', desc: 'Invite friends, get bonus', icon: Users, tile: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  { view: 'push', label: 'Push Notifications', desc: 'Send alerts to your app users', icon: Megaphone, tile: 'bg-sky-50', iconColor: 'text-sky-600' },
  { view: 'notifications', label: 'My Alerts', desc: 'Site alerts & updates', icon: Bell, tile: 'bg-violet-50', iconColor: 'text-violet-600' },
  { view: 'appDownload', label: 'Download App', desc: 'Get our official Android app', icon: Smartphone, tile: 'bg-violet-50', iconColor: 'text-violet-700' },
  { view: 'adminPanel', label: 'Admin Panel', desc: 'Platform & build engine settings', icon: ShieldCheck, tile: 'bg-slate-900', iconColor: 'text-white', adminOnly: true },
]

const ADMIN_EMAILS = ['zarif@apkforge.test']

export default function MoreDrawer() {
  const { showMore, setShowMore, user, setView, setUser, showToast } = useApp()
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setShowMore(false)
    showToast('Logged out successfully')
  }
  const initials = user?.name ? user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase() : 'U'

  return (
    <>
      {showMore && <div className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[3px] animate-in fade-in duration-200" onClick={() => setShowMore(false)} />}
      <div className={`fixed top-0 right-0 z-50 h-full w-[88%] max-w-sm bg-slate-50 shadow-2xl transform transition-transform duration-300 ${showMore ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 px-5 pt-7 pb-6 text-white overflow-hidden">
            <div className="absolute -top-16 -right-12 w-48 h-48 rounded-full bg-violet-500/30 blur-3xl" />
            <div className="absolute -bottom-12 -left-10 w-32 h-32 rounded-full bg-fuchsia-500/20 blur-2xl" />
            <svg className="absolute inset-0 w-full h-full opacity-[0.05]" aria-hidden="true">
              <defs><pattern id="more-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="white" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#more-dots)" />
            </svg>
            <button onClick={() => setShowMore(false)} className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors z-10" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-violet-500/30 ring-2 ring-white/10">{initials}</div>
              <div className="min-w-0">
                <div className="font-extrabold text-white text-lg truncate uppercase tracking-tight">{user?.name}</div>
                <div className="text-sm text-slate-300/90 truncate">{user?.email}</div>
                <span className="inline-flex items-center gap-1 mt-1.5 bg-white/10 border border-white/15 text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full"><Zap className="w-2.5 h-2.5 text-amber-300" /> {user?.plan} plan</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto bg-white mt-2 px-3 py-3 space-y-1">
            {MENU.filter((m) => !m.adminOnly || user?.role === 'ADMIN' || ADMIN_EMAILS.includes((user?.email || '').toLowerCase())).map((m) => {
              const Icon = m.icon
              return (
                <button key={m.view} onClick={() => { setShowMore(false); setView(m.view) }} className="group w-full flex items-center gap-4 px-3 py-3.5 rounded-2xl hover:bg-slate-50 active:bg-slate-100 transition-colors text-left">
                  <div className={`w-11 h-11 rounded-xl ${m.tile} flex items-center justify-center shrink-0 ring-1 ring-black/5`}><Icon className={`w-5 h-5 ${m.iconColor}`} /></div>
                  <div className="flex-1 min-w-0"><div className="font-bold text-slate-800">{m.label}</div><div className="text-xs text-slate-400 leading-snug">{m.desc}</div></div>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              )
            })}
          </div>
          <div className="p-4 bg-white border-t border-slate-100">
            <button onClick={logout} className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 font-bold hover:bg-rose-100 transition-colors">
              <LogOut className="w-5 h-5" /> Logout
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-3 flex items-center justify-center gap-1"><Zap className="w-3 h-3 text-violet-500" /> ApkForge v2.5 • Built for builders</p>
          </div>
        </div>
      </div>
    </>
  )
}
