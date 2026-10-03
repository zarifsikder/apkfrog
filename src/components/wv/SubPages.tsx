'use client'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWvEvent } from '@/lib/realtime'
import {
  ChevronLeft, Wallet, Smartphone, Loader2, Copy, Users, Gift, Bell, CreditCard,
  Clock, CheckCircle2, XCircle, Crown, Check, Star,
} from 'lucide-react'
import type { PaymentDTO, NotificationDTO, NotificationCommentDTO, PlanDTO } from '@/lib/types'

function SubHeader({ title, sub }: { title: string; sub: string }) {
  const { setView, goBack } = useApp()
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-100">
      <div className="flex items-center gap-3 px-4 h-16 max-w-2xl mx-auto">
        <button onClick={() => goBack()} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200" aria-label="Back">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 leading-tight">{title}</h1>
          <p className="text-[11px] text-slate-400 -mt-0.5">{sub}</p>
        </div>
      </div>
    </header>
  )
}

export function ProfilePage() {
  const { user, setUser, showToast } = useApp()
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [oldPass, setOldPass] = useState('')

  const initials = (user?.name || 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setSaving(false)
    const data = await res.json()
    if (res.ok) {
      setUser(data.user)
      showToast('Profile updated ✓')
    } else showToast(data.error || 'Update failed')
  }

  return (
    <div className="pb-24">
      <SubHeader title="Profile" sub="Account settings" />
      <main className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-violet-600 p-6 text-white text-center relative overflow-hidden">
          <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-black mx-auto">{initials}</div>
          <h2 className="text-xl font-extrabold mt-3 uppercase">{user?.name}</h2>
          <p className="text-violet-50 text-sm">{user?.email}</p>
          <span className="inline-block mt-2 bg-white/15 border border-white/25 text-xs font-bold rounded-full px-3 py-1">{user?.plan} Plan • Member since {new Date(user?.createdAt || Date.now()).toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span>
          {user?.publicId && (
            <div className="mt-3 inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full pl-3 pr-1.5 py-1">
              <span className="text-[10px] font-bold tracking-widest text-violet-200/80">USER ID</span>
              <code className="text-xs font-mono font-bold tracking-wider text-white">{user.publicId}</code>
              <button
                onClick={() => { navigator.clipboard?.writeText(user.publicId); showToast('User ID copied') }}
                className="w-6 h-6 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors"
                aria-label="Copy user ID"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm">ACCOUNT DETAILS</h3>
          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">DISPLAY NAME</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" />
          </div>
          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">EMAIL</label>
            <Input value={user?.email || ''} disabled className="h-12 rounded-xl bg-slate-50 text-slate-400" />
          </div>
          <Button onClick={save} disabled={saving} className="w-full h-12 rounded-xl bg-slate-900 font-bold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
          </Button>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
          <h3 className="font-extrabold text-slate-900 text-sm mb-3">SECURITY</h3>
          <p className="text-xs text-slate-400 leading-relaxed">Your password is secured with scrypt hashing. To change your password, logout and use "Forgot password" — or contact support@apkforge.app for account recovery.</p>
          <div className="mt-3">
            <Input value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder="Current password" type="password" className="h-12 rounded-xl" disabled />
          </div>
        </div>
      </main>
    </div>
  )
}

export function WalletPage() {
  const { user, showToast, setUser } = useApp()
  const [payments, setPayments] = useState<PaymentDTO[]>([])
  // --- auto pay (AmarPay gateway) ---
  const [autoAmount, setAutoAmount] = useState('100')
  const [autoLoading, setAutoLoading] = useState(false)
  const [pendingAuto, setPendingAuto] = useState<PaymentDTO | null>(null)
  const [checking, setChecking] = useState(false)

  const load = () =>
    fetch('/api/payments')
      .then((r) => r.json())
      .then((d) => {
        const list: PaymentDTO[] = d.payments || []
        setPayments(list)
        setPendingAuto(list.find((p) => p.gateway === 'amarpay' && p.status === 'pending') || null)
      })
      .catch(() => {})
  useEffect(() => { load() }, [])
  useWvEvent(['payments', 'wallet'], () => { load() })

  const startAutoPay = async () => {
    setAutoLoading(true)
    try {
      const res = await fetch('/api/payments/auto/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: autoAmount }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.paymentUrl) {
        showToast('Opening secure checkout…')
        window.location.href = data.paymentUrl
        return
      }
      showToast(data.error || 'Could not start the payment. Try again.')
    } catch {
      showToast('Network error — try again.')
    }
    setAutoLoading(false)
  }

  const checkStatus = async () => {
    if (!pendingAuto) return
    setChecking(true)
    try {
      const res = await fetch('/api/payments/auto/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: pendingAuto.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.status === 'approved') {
        showToast(`৳${data.amount} added to your wallet ✅`)
        if (typeof data.wallet === 'number' && user) setUser({ ...user, wallet: data.wallet })
      } else {
        showToast(data.message || data.error || 'Payment is not confirmed yet.')
      }
      load()
    } catch {
      showToast('Network error — try again.')
    }
    setChecking(false)
  }

  const quickAmounts = ['100', '300', '500', '1000']

  return (
    <div className="pb-24">
      <SubHeader title="Wallet" sub="Balance & transactions" />
      <main className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">
        <div className="rounded-3xl bg-amber-500 p-6 text-white relative overflow-hidden shadow-xl shadow-amber-500/20">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl" />
          <div className="flex items-center gap-2 text-amber-100 text-xs font-bold"><Wallet className="w-4 h-4" /> TOTAL BALANCE</div>
          <div className="text-4xl font-black mt-2">৳{user?.wallet ?? 0}</div>
          <p className="text-amber-100 text-xs mt-1">Use balance to buy subscriptions & premium templates</p>
        </div>

        {pendingAuto && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">৳{pendingAuto.amount} auto payment in progress</p>
              <p className="text-[11px] text-amber-600">Paid already? Verify it now — the balance is added automatically.</p>
            </div>
            <Button onClick={checkStatus} disabled={checking} className="h-10 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold px-4">
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check status'}
            </Button>
          </div>
        )}

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm">ADD MONEY</h3>
            <span className="text-[10px] font-extrabold tracking-wide bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full">AUTO · INSTANT</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">Pay securely through the AmarPayment gateway (bKash, Nagad, cards & more). Your wallet is credited automatically the moment payment succeeds. Subscriptions bought from your Subscription page use this balance first; if the balance is short, the same gateway opens automatically.</p>
          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">AMOUNT (৳)</label>
            <Input value={autoAmount} onChange={(e) => setAutoAmount(e.target.value.replace(/\D/g, ''))} className="h-12 rounded-xl" inputMode="numeric" placeholder="Enter amount" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q}
                onClick={() => setAutoAmount(q)}
                className={`rounded-xl border-2 py-2.5 font-bold text-sm transition-all ${autoAmount === q ? 'border-slate-900 bg-violet-50 text-slate-900' : 'border-slate-200 text-slate-500'}`}
              >
                ৳{q}
              </button>
            ))}
          </div>
          <Button onClick={startAutoPay} disabled={autoLoading || !autoAmount || parseInt(autoAmount) < 20} className="w-full h-12 rounded-xl bg-slate-900 font-bold">
            {autoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Pay Now — ৳${autoAmount || 0}`}
          </Button>
          <p className="text-[11px] text-slate-400 text-center">Minimum ৳20. You will return here automatically after paying.</p>
        </div>

        {payments.length > 0 && (
          <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-2">
            <h3 className="font-extrabold text-slate-900 text-sm">RECENT TRANSACTIONS</h3>
            <div className="space-y-2">
              {payments.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : p.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                    {p.status === 'approved' ? <CheckCircle2 className="w-4 h-4" /> : p.status === 'rejected' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-800">৳{p.amount} · {p.gateway === 'amarpay' ? 'Auto payment' : p.method}</div>
                    <div className="text-[10px] text-slate-400 font-mono truncate">{p.trxId}</div>
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${p.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : p.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>{p.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentDTO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/payments').then((r) => r.json()).then((d) => {
      setPayments(d.payments || [])
      setLoading(false)
    })
  }, [])

  // Real-time: payment requests submitted from the Android app appear here instantly
  useWvEvent(['payments'], () => {
    fetch('/api/payments').then((r) => r.json()).then((d) => setPayments(d.payments || [])).catch(() => {})
  })

  const statusMeta: Record<string, { icon: typeof Clock; cls: string; label: string }> = {
    pending: { icon: Clock, cls: 'bg-amber-100 text-amber-600', label: 'Pending' },
    approved: { icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-600', label: 'Approved' },
    rejected: { icon: XCircle, cls: 'bg-red-100 text-red-600', label: 'Rejected' },
  }

  return (
    <div className="pb-24">
      <SubHeader title="My Payments" sub="Track pending & past requests" />
      <main className="px-4 pt-5 max-w-2xl mx-auto space-y-3">
        {loading ? (
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ) : payments.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 py-16 text-center px-8">
            <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-extrabold text-slate-700">No payment requests yet</h3>
            <p className="text-slate-400 text-sm mt-1">Add money from your Wallet to buy premium templates.</p>
          </div>
        ) : (
          payments.map((p) => {
            const meta = statusMeta[p.status] || statusMeta.pending
            const Icon = meta.icon
            return (
              <div key={p.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.cls}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-slate-900">৳{p.amount} • {p.method.toUpperCase()}</div>
                  <div className="text-xs text-slate-400 truncate">TrxID: {p.trxId} • {new Date(p.createdAt).toLocaleString()}</div>
                </div>
                <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${meta.cls}`}>{meta.label}</span>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}

export function SubscriptionPage() {
  const { user, showToast, setUser } = useApp()
  const [plans, setPlans] = useState<PlanDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null) // planId currently being purchased

  const load = () => {
    fetch('/api/plans')
      .then((r) => r.json())
      .then((d) => { setPlans(d.plans || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useWvEvent(['plans'], () => load())

  const buy = async (plan: PlanDTO) => {
    if (buying) return
    setBuying(plan.id)
    try {
      const res = await fetch('/api/subscriptions/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, cycle: 'monthly' }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        showToast(data.error || 'Could not start the purchase. Try again.')
        setBuying(null)
        return
      }

      if (data.source === 'wallet') {
        // Wallet payment succeeded — plan is active now
        showToast(`${plan.name} activated from wallet balance ✓`)
        if (user && typeof data.wallet === 'number') {
          setUser({ ...user, plan: plan.name, wallet: data.wallet })
        }
        load()
        setBuying(null)
        return
      }

      if (data.source === 'gateway' && data.paymentUrl) {
        showToast('Insufficient balance — opening secure payment…')
        // Small delay so the toast is visible before the redirect
        setTimeout(() => { window.location.href = data.paymentUrl }, 600)
        return
      }

      showToast('Unexpected response from server.')
      setBuying(null)
    } catch {
      showToast('Network error — try again.')
      setBuying(null)
    }
  }

  const accentMap: Record<string, { ring: string; text: string; tile: string }> = {
    violet:  { ring: 'border-violet-500',  text: 'text-violet-600',  tile: 'bg-violet-50' },
    fuchsia: { ring: 'border-fuchsia-500', text: 'text-fuchsia-600', tile: 'bg-fuchsia-50' },
    amber:   { ring: 'border-amber-500',   text: 'text-amber-600',   tile: 'bg-amber-50' },
    emerald: { ring: 'border-emerald-500', text: 'text-emerald-600', tile: 'bg-emerald-50' },
    slate:   { ring: 'border-slate-500',   text: 'text-slate-600',   tile: 'bg-slate-100' },
  }

  return (
    <div className="pb-24">
      <SubHeader title="Subscription" sub="Plans & upgrades" />
      <main className="px-4 pt-5 max-w-2xl mx-auto space-y-4">
        {/* wallet balance banner */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 p-4 text-white flex items-center gap-3 shadow-md shadow-amber-500/20">
          <Wallet className="w-6 h-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-amber-100">WALLET BALANCE</p>
            <p className="text-xl font-black tabular-nums">৳{user?.wallet ?? 0}</p>
          </div>
          <p className="text-[11px] text-amber-50 leading-snug text-right max-w-[60%]">If your balance covers the plan price, the subscription is activated instantly. Otherwise you'll be redirected to secure payment.</p>
        </div>

        {loading ? (
          <div className="grid gap-4">
            <div className="h-44 rounded-3xl bg-slate-100 animate-pulse" />
            <div className="h-44 rounded-3xl bg-slate-100 animate-pulse" />
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-16 text-center px-8">
            <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-extrabold text-slate-700">No plans available</h3>
            <p className="text-slate-400 text-sm mt-1">Please check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map((p) => {
              const accent = accentMap[p.accent] || accentMap.violet
              const isCurrent = (user?.plan || 'Free') === p.name
              const isPro = p.price > 0
              const features = p.features.split('\n').filter(Boolean)
              const balanceCovers = (user?.wallet ?? 0) >= p.price
              return (
                <div
                  key={p.id}
                  className={`relative overflow-hidden rounded-3xl border-2 p-6 transition-all ${
                    isPro
                      ? `bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 text-white ${isCurrent ? 'border-amber-400' : 'border-slate-800'}`
                      : `${isCurrent ? `${accent.ring} shadow-lg shadow-violet-500/10` : 'border-slate-200'} bg-white`
                  }`}
                >
                  {isPro && (
                    <>
                      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-violet-500/25 blur-3xl" />
                      <div className="absolute -bottom-12 -left-10 w-32 h-32 rounded-full bg-amber-400/15 blur-2xl" />
                    </>
                  )}
                  <div className="relative">
                    {isCurrent ? (
                      <span className={`inline-block mb-2 text-[10px] font-black px-3 py-1 rounded-full tracking-wide ${isPro ? 'bg-amber-400 text-slate-900' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'}`}>CURRENT PLAN</span>
                    ) : p.isPopular ? (
                      <span className="inline-block mb-2 bg-amber-400 text-slate-900 text-[10px] font-black px-3 py-1 rounded-full tracking-wide">RECOMMENDED</span>
                    ) : null}

                    <div className={`flex items-center gap-2 font-extrabold text-lg ${isPro ? '' : 'text-slate-900'}`}>
                      {isPro ? <Crown className="w-5 h-5 text-amber-400" /> : <Smartphone className={`w-5 h-5 ${accent.text}`} />}
                      {p.name}
                    </div>

                    {p.description && (
                      <p className={`text-xs mt-1 leading-relaxed ${isPro ? 'text-slate-300' : 'text-slate-500'}`}>{p.description}</p>
                    )}

                    <div className={`text-3xl font-black mt-2 tabular-nums tracking-tight ${isPro ? '' : 'text-slate-900'}`}>
                      ৳{p.price}
                      <span className={`text-sm font-semibold ${isPro ? 'text-slate-400' : 'text-slate-400'}`}>
                        {p.price === 0 ? '/forever' : '/month'}
                      </span>
                      {p.priceYearly > 0 && <span className="text-sm font-semibold ml-2 text-slate-400">· ৳{p.priceYearly}/year</span>}
                    </div>

                    {features.length > 0 && (
                      <ul className={`mt-4 space-y-2 text-sm ${isPro ? 'text-slate-300' : 'text-slate-600'}`}>
                        {features.map((f, i) => (
                          <li key={i} className="flex items-center gap-2">
                            {isPro ? <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" /> : <Check className={`w-4 h-4 ${accent.text} shrink-0`} />}
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}

                    {isPro && !isCurrent && (
                      <div className={`mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 ${balanceCovers ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-400/20 text-amber-300'}`}>
                        <Wallet className="w-3.5 h-3.5" />
                        {balanceCovers
                          ? `Buys instantly from wallet (৳${user?.wallet ?? 0} balance)`
                          : `Wallet ৳${user?.wallet ?? 0} — short by ৳${p.price - (user?.wallet ?? 0)}, gateway will open`}
                      </div>
                    )}

                    <Button
                      onClick={() => buy(p)}
                      disabled={isCurrent || buying === p.id}
                      className={`w-full h-12 mt-5 rounded-xl font-extrabold shadow-md disabled:opacity-70 ${
                        isPro
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 shadow-amber-500/25'
                          : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-violet-500/25'
                      }`}
                    >
                      {buying === p.id
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                        : isCurrent
                          ? 'Current Plan ✓'
                          : p.price === 0
                            ? 'Stay on Free'
                            : balanceCovers
                              ? `Buy with wallet — ৳${p.price}`
                              : `Upgrade to ${p.name}`}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

export function ReferralsPage() {
  const { user, showToast } = useApp()
  const [joined, setJoined] = useState(0)

  useEffect(() => {
    fetch('/api/stats').then(() => {}).catch(() => {})
  }, [])

  const link = typeof window !== 'undefined' ? `${window.location.origin}?ref=${user?.referralCode || ''}` : ''

  return (
    <div className="pb-24">
      <SubHeader title="Refer & Earn" sub="Invite friends, get bonus" />
      <main className="px-4 pt-5 max-w-2xl mx-auto space-y-4">
        <div className="rounded-3xl bg-emerald-600 p-6 text-white relative overflow-hidden shadow-xl shadow-emerald-500/20">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl" />
          <Users className="w-8 h-8" />
          <h2 className="text-2xl font-extrabold mt-3">Invite friends, get ৳50</h2>
          <p className="text-emerald-100 text-sm mt-1">For every friend who registers with your code, you both get ৳50 wallet bonus.</p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">YOUR REFERRAL CODE</label>
            <div className="flex gap-2">
              <div className="flex-1 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center font-mono font-black text-lg tracking-widest text-slate-900">{user?.referralCode}</div>
              <Button onClick={() => { navigator.clipboard?.writeText(user?.referralCode || ''); showToast('Code copied') }} className="h-12 px-5 rounded-xl bg-slate-900 font-bold">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">INVITE LINK</label>
            <div className="flex gap-2">
              <div className="flex-1 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center px-3 text-xs text-slate-500 truncate">{link}</div>
              <Button onClick={() => { navigator.clipboard?.writeText(link); showToast('Invite link copied') }} className="h-12 px-5 rounded-xl bg-slate-900 font-bold">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="text-2xl font-black text-slate-900">{joined}</div>
              <div className="text-xs text-slate-400">Friends joined</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <div className="text-2xl font-black text-emerald-600">৳{joined * 50}</div>
              <div className="text-xs text-slate-400">Bonus earned</div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-50 rounded-xl p-3">
            <Gift className="w-4 h-4 text-emerald-500 shrink-0" />
            Bonuses are credited automatically when your friend completes registration with your referral code.
          </div>
        </div>
      </main>
    </div>
  )
}

export function NotificationsPage() {
  const { showToast } = useApp()
  const [items, setItems] = useState<NotificationDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [openNotif, setOpenNotif] = useState<(NotificationDTO & { comments?: NotificationCommentDTO[] }) | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)

  const load = () =>
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.notifications || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  // Real-time: new notifications, admin replies, or read-state from other clients
  useWvEvent(['notifications'], () => {
    load()
    // If a reply arrived while a notification is open, refresh the open thread too
    if (openId) void openNotification(openId, true)
  })

  const markAll = async () => {
    await fetch('/api/notifications', { method: 'POST' })
    load()
  }

  const openNotification = async (id: string, silent = false) => {
    if (!silent) setLoadingDetail(true)
    try {
      const res = await fetch(`/api/notifications/${id}`)
      if (!res.ok) throw new Error('failed')
      const d = await res.json()
      setOpenNotif(d.notification)
      setOpenId(id)
      // reflect read state in the list immediately
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    } catch {
      if (!silent) showToast('Could not open notification')
    } finally {
      if (!silent) setLoadingDetail(false)
    }
  }

  const closeDetail = () => {
    setOpenId(null)
    setOpenNotif(null)
    setCommentText('')
  }

  const postComment = async () => {
    if (!openNotif) return
    const text = commentText.trim()
    if (!text) return
    setPosting(true)
    try {
      const res = await fetch(`/api/notifications/${openNotif.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(d.error || 'Could not post comment')
      } else {
        setOpenNotif((prev) =>
          prev ? { ...prev, comments: [...(prev.comments || []), d.comment] } : prev,
        )
        setCommentText('')
        showToast('Comment posted — admin will see it')
      }
    } catch {
      showToast('Network error')
    } finally {
      setPosting(false)
    }
  }

  // ---------- DETAIL VIEW ----------
  if (openId && openNotif) {
    const comments = openNotif.comments || []
    return (
      <div className="pb-24">
        <SubHeader title="Notification" sub="Detail & comments" />
        <main className="px-4 pt-5 max-w-2xl mx-auto space-y-4">
          {/* back */}
          <button onClick={closeDetail} className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800">
            <ChevronLeft className="w-4 h-4" /> Back to all alerts
          </button>

          {/* the notification body */}
          <section className={`rounded-2xl border p-4 ${openNotif.read ? 'bg-white border-slate-100' : 'bg-violet-50/60 border-violet-50'}`}>
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${openNotif.read ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-extrabold ${openNotif.read ? 'text-slate-700' : 'text-slate-900'}`}>{openNotif.title}</div>
                <div className="text-sm text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap break-words">{openNotif.body}</div>
                <div className="text-[10px] text-slate-400 mt-2">{new Date(openNotif.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </section>

          {/* comment thread */}
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-700" />
              <h3 className="font-extrabold text-slate-800 text-sm">Comments ({comments.length})</h3>
            </div>

            {comments.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-slate-400">No comments yet. Reply below to ask the admin a question about this notification.</p>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-3 max-h-96 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className={`flex gap-2.5 ${c.isAdminReply ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold ${c.isAdminReply ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600' : 'bg-slate-700'}`}>
                      {c.isAdminReply ? 'AD' : (c.userName || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div className={`flex-1 min-w-0 max-w-[78%] ${c.isAdminReply ? 'text-right' : ''}`}>
                      <div className={`inline-block text-left rounded-2xl px-3.5 py-2.5 ${c.isAdminReply ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                        <div className="text-[10px] font-bold mb-0.5 opacity-80">
                          {c.isAdminReply ? 'Admin' : c.userName}
                          {' · '}
                          {new Date(c.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-sm whitespace-pre-wrap break-words">{c.body}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* compose */}
            <div className="border-t border-slate-100 p-3 space-y-2">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                placeholder="Write a comment — admin will see & reply here…"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">{commentText.length}/2000</span>
                <button
                  onClick={postComment}
                  disabled={posting || !commentText.trim()}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-slate-900 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                >
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {posting ? 'Posting…' : 'Post comment'}
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  // ---------- LIST VIEW ----------
  return (
    <div className="pb-24">
      <SubHeader title="My Alerts" sub="Site alerts & updates" />
      <main className="px-4 pt-5 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-500">{items.filter((n) => !n.read).length} unread</span>
          <button onClick={markAll} className="text-slate-900 text-sm font-bold">Mark all read</button>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-200 py-16 text-center px-8">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-extrabold text-slate-700">No notifications</h3>
            <p className="text-slate-400 text-sm mt-1">Build alerts, payment updates and admin broadcasts will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openNotification(n.id)}
                className={`w-full text-left rounded-2xl border p-4 flex gap-3 transition-all hover:shadow-md hover:shadow-slate-900/5 ${n.read ? 'bg-white border-slate-100' : 'bg-violet-50/60 border-violet-50'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-slate-900 shrink-0 mt-1.5" />}
                <ChevronLeft className="w-4 h-4 text-slate-300 rotate-180 shrink-0 self-center" />
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
