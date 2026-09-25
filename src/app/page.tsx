'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import type { SessionUser, ViewName } from '@/lib/types'
import AuthView from '@/components/wv/AuthView'
import HomeView from '@/components/wv/HomeView'
import StoreView from '@/components/wv/StoreView'
import SellerView from '@/components/wv/SellerView'
import EditorView from '@/components/wv/EditorView'
import BuildFormView from '@/components/wv/BuildFormView'
import ConsoleView from '@/components/wv/ConsoleView'
import ReadyView from '@/components/wv/ReadyView'
import NewProjectModal from '@/components/wv/NewProjectModal'
import MoreDrawer from '@/components/wv/MoreDrawer'
import BottomNav from '@/components/wv/BottomNav'
import AdminView from '@/components/wv/AdminView'
import AppDownloadView from '@/components/wv/AppDownloadView'
import PushView from '@/components/wv/PushView'
import { useWvEvent, closeRealtime } from '@/lib/realtime'
import { ProfilePage, WalletPage, PaymentsPage, SubscriptionPage, ReferralsPage, NotificationsPage } from '@/components/wv/SubPages'

function Toast() {
  const { toast } = useApp()
  if (!toast) return null
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 text-white text-sm font-semibold px-5 py-3 rounded-full shadow-2xl max-w-[90%] text-center animate-in fade-in slide-in-from-bottom-4">
      {toast}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
        <span className="text-white font-black text-2xl tracking-tighter">{'{w}'}</span>
      </div>
      <p className="relative text-white font-extrabold text-xl tracking-tight">APKFORGE</p>
    </div>
  )
}

export default function Page() {
  const { user, setUser, view, setView, goBack } = useApp()
  const [booting, setBooting] = useState(true)

  // Handle browser back button — uses our view history instead of leaving the page
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault()
      goBack()
      // push a new state so the browser stays on our page
      window.history.pushState(null, '', window.location.href)
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [goBack])

  // Real-time (Task 12): wallet/profile changes made on the Android app (or any
  // other tab) refresh the signed-in user immediately
  useWvEvent(['wallet', 'user'], () => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user as SessionUser)
      })
      .catch(() => {})
  })

  // drop the live connection on logout (re-opened automatically after login)
  useEffect(() => {
    if (!user && !booting) closeRealtime()
  }, [user, booting])

  // Check referral + deep-link view param before register
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const ref = sp.get('ref')
    if (ref) window.sessionStorage.setItem('wv_ref', ref)
    const v = sp.get('view')
    if (v && ['home', 'store', 'build', 'console', 'ready', 'profile', 'wallet', 'payments', 'subscription', 'referrals', 'notifications', 'push', 'adminPanel', 'seller', 'purchases'].includes(v)) {
      setView(v as ViewName)
    }
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUser(d.user as SessionUser)
        setBooting(false)
      })
      .catch(() => setBooting(false))
  }, [])

  if (booting) return <LoadingScreen />

  if (!user) {
    return (
      <AuthView
        onAuthed={(u) => {
          setUser(u)
          setView('home')
        }}
      />
    )
  }

  const showNav = ['home', 'store', 'build', 'console', 'ready', 'profile', 'wallet', 'payments', 'subscription', 'referrals', 'notifications', 'push', 'appDownload', 'adminPanel', 'seller', 'purchases'].includes(view)

  return (
    <div className="min-h-dvh bg-slate-50">
      {view === 'home' && <HomeView />}
      {view === 'store' && <StoreView />}
      {view === 'seller' && <SellerView />}
      {view === 'purchases' && <SellerView initialTab="purchases" />}
      {view === 'editor' && <EditorView />}
      {view === 'build' && <BuildFormView />}
      {view === 'console' && <ConsoleView />}
      {view === 'ready' && <ReadyView />}
      {view === 'profile' && <ProfilePage />}
      {view === 'wallet' && <WalletPage />}
      {view === 'payments' && <PaymentsPage />}
      {view === 'subscription' && <SubscriptionPage />}
      {view === 'referrals' && <ReferralsPage />}
      {view === 'notifications' && <NotificationsPage />}
      {view === 'push' && <PushView />}
      {view === 'appDownload' && <AppDownloadView />}
      {view === 'adminPanel' && <AdminView />}

      {showNav && <BottomNav />}
      <NewProjectModal />
      <MoreDrawer />
      <Toast />
    </div>
  )
}
