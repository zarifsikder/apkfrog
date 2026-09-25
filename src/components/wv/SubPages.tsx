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
import type { PaymentDTO, NotificationDTO, PlanDTO } from '@/lib/types'

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
  const [amount, setAmount] = useState('100')
  const [method, setMethod] = useState('bkash')
  const [senderNumber, setSenderNumber] = useState('')
  const [trxId, setTrxId] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  const submit = async () => {
    setSubmitting(true)
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, method, senderNumber, trxId }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (res.ok) {
      showToast('Payment request submitted — pending review')
      setSenderNumber('')
      setTrxId('')
      load()
    } else showToast(data.error || 'Request failed')
  }

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

  const methods = [
    { id: 'bkash', label: 'bKash', color: 'bg-pink-600', number: '01700-000000' },
    { id: 'nagad', label: 'Nagad', color: 'bg-orange-500', number: '01800-000000' },
    { id: 'rocket', label: 'Rocket', color: 'bg-slate-900', number: '01900-000000' },
  ]
  const m = methods.find((x) => x.id === method)!
  const quickAmounts = ['100', '300', '500', '1000']

  return (
    <div className="pb-24">
      <SubHeader title="Wallet" sub="Balance & transactions" />
      <main className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">
        <div className="rounded-3xl bg-amber-500 p-6 text-white relative overflow-hidden shadow-xl shadow-amber-500/20">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl" />
          <div className="flex items-center gap-2 text-amber-100 text-xs font-bold"><Wallet className="w-4 h-4" /> TOTAL BALANCE</div>
          <div className="text-4xl font-black mt-2">৳{user?.wallet ?? 0}</div>
          <p className="text-amber-100 text-xs mt-1">Use balance to buy premium templates</p>
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
            <h3 className="font-extrabold text-slate-900 text-sm">ADD MONEY — AUTO</h3>
            <span className="text-[10px] font-extrabold tracking-wide bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full">INSTANT</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">Pay securely through the AmarPayment gateway (bKash, Nagad, cards & more). Your wallet is credited automatically the moment payment succeeds.</p>
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

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm">MANUAL — BKASH / NAGAD / ROCKET</h3>
          <div className="grid grid-cols-3 gap-2">
            {methods.map((x) => (
              <button
                key={x.id}
                onClick={() => setMethod(x.id)}
                className={`rounded-xl border-2 py-3 font-bold text-sm transition-all ${method === x.id ? 'border-slate-900 bg-violet-50 text-slate-900' : 'border-slate-200 text-slate-500'}`}
              >
                {x.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-slate-50 p-3.5 text-sm">
            <p className="text-slate-500 text-xs">Send money to this <b className={method === 'bkash' ? 'text-pink-600' : method === 'nagad' ? 'text-orange-500' : 'text-slate-900'}>{m.label}</b> Personal number:</p>
            <div className="flex items-center justify-between mt-1.5">
              <span className="font-black text-slate-800 text-base">{m.number}</span>
              <button onClick={() => { navigator.clipboard?.writeText(m.number.replace('-', '')); showToast('Number copied') }} className="text-slate-900 text-xs font-bold flex items-center gap-1">
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">AMOUNT (৳)</label>
              <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} className="h-12 rounded-xl" inputMode="numeric" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">SENDER NUMBER</label>
              <Input value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} placeholder="01XXXXXXXXX" className="h-12 rounded-xl" inputMode="tel" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-extrabold tracking-widest text-slate-500 mb-1.5">TRANSACTION ID (TrxID)</label>
            <Input value={trxId} onChange={(e) => setTrxId(e.target.value.toUpperCase())} placeholder="e.g. 9F7A2K1B2C" className="h-12 rounded-xl font-mono" />
          </div>
          <Button onClick={submit} disabled={submitting} className="w-full h-12 rounded-xl bg-slate-900 font-bold">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Submit Request — ৳${amount || 0}`}
          </Button>
          <p className="text-[11px] text-slate-400 text-center">Minimum ৳20. Balance is added after manual verification (usually within 30 minutes).</p>
        </div>
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
  const { user, showToast } = useApp()
  const [plans, setPlans] = useState<PlanDTO[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    fetch('/api/plans')
      .then((r) => r.json())
      .then((d) => { setPlans(d.plans || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  useWvEvent(['plans'], () => load())

  const upgrade = (planName: string) => showToast(`Upgrade request received for "${planName}" — we'll contact you shortly.`)

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

                    <Button
                      onClick={() => upgrade(p.name)}
                      disabled={isCurrent}
                      className={`w-full h-12 mt-5 rounded-xl font-extrabold shadow-md disabled:opacity-70 ${
                        isPro
                          ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 shadow-amber-500/25'
                          : 'bg-gradient-to-br from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white shadow-violet-500/25'
                      }`}
                    >
                      {isCurrent ? 'Current Plan ✓' : p.price === 0 ? 'Stay on Free' : `Upgrade to ${p.name}`}
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
  const [items, setItems] = useState<NotificationDTO[]>([])
  const [loading, setLoading] = useState(true)

  const load = () =>
    fetch('/api/notifications')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.notifications || [])
        setLoading(false)
      })

  useEffect(() => {
    load()
  }, [])

  // Real-time: new notifications (APK ready, purchases…) from any client show up here instantly
  useWvEvent(['notifications'], () => {
    load()
  })

  const markAll = async () => {
    await fetch('/api/notifications', { method: 'POST' })
    load()
  }

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
            <p className="text-slate-400 text-sm mt-1">Build alerts and payment updates will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((n) => (
              <div key={n.id} className={`rounded-2xl border p-4 flex gap-3 ${n.read ? 'bg-white border-slate-100' : 'bg-violet-50/60 border-violet-50'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-bold text-sm ${n.read ? 'text-slate-700' : 'text-slate-900'}`}>{n.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{n.body}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-slate-900 shrink-0 mt-1.5" />}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
