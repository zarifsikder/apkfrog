'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, Loader2, Wallet, ArrowRight } from 'lucide-react'

function SuccessInner() {
  const params = useSearchParams()
  const pid = params.get('pid') || ''
  const trx = params.get('transactionId') || ''
  const gatewayStatus = (params.get('status') || '').toLowerCase()
  const gatewayAmount = params.get('paymentAmount') || ''

  const [state, setState] = useState<'loading' | 'ok' | 'pending' | 'fail' | 'nosession'>('loading')
  const [message, setMessage] = useState('')
  const [wallet, setWallet] = useState<number | null>(null)
  const [amount, setAmount] = useState<number | null>(gatewayAmount ? parseFloat(gatewayAmount) : null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/payments/auto/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: pid, transactionId: trx }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          setState('nosession')
          setMessage('Your session is not in this browser. Open the site, go to Wallet and tap "Check status" to finish verification.')
          return
        }
        if (data.status === 'approved') {
          setState('ok')
          setWallet(data.wallet ?? null)
          setAmount((prev) => prev ?? data.amount ?? null)
          setMessage(data.alreadyDone ? 'This payment was already verified.' : 'Payment verified automatically — the money is in your wallet.')
        } else if (res.ok) {
          setState(gatewayStatus === 'failed' ? 'fail' : 'pending')
          setMessage(data.message || data.error || 'Payment is not confirmed yet. Tap "Check status" in your Wallet in a moment.')
        } else {
          setState('fail')
          setMessage(data.error || 'Verification failed.')
        }
      } catch {
        setState('pending')
        setMessage('Network hiccup — if you were charged, tap "Check status" in your Wallet.')
      }
    })()
  }, [pid, trx, gatewayStatus])

  const meta = {
    ok: { icon: CheckCircle2, ring: 'bg-emerald-100 text-emerald-600', title: 'Payment Successful' },
    pending: { icon: Loader2, ring: 'bg-amber-100 text-amber-600', title: 'Verifying Payment' },
    fail: { icon: XCircle, ring: 'bg-red-100 text-red-600', title: 'Payment Failed' },
    nosession: { icon: Wallet, ring: 'bg-violet-50 text-slate-900', title: 'Almost There' },
    loading: { icon: Loader2, ring: 'bg-amber-100 text-amber-600', title: 'Verifying Payment' },
  }[state]
  const Icon = meta.icon

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center">
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${meta.ring}`}>
          <Icon className={`w-8 h-8 ${state === 'loading' || state === 'pending' ? 'animate-spin' : ''}`} />
        </div>
        <h1 className="text-xl font-black text-slate-900 mt-4">{meta.title}</h1>
        {amount != null && state === 'ok' && (
          <p className="text-3xl font-black text-emerald-600 mt-2">+৳{amount}</p>
        )}
        {wallet != null && state === 'ok' && (
          <p className="text-sm text-slate-500 mt-1">New wallet balance: <b className="text-slate-700">৳{wallet}</b></p>
        )}
        <p className="text-sm text-slate-500 leading-relaxed mt-3">{message}</p>
        {trx && <p className="text-[11px] font-mono text-slate-300 mt-2 break-all">TrxID: {trx}</p>}

        <div className="mt-6 space-y-2">
          <a
            href="/?view=wallet"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-900 transition-colors"
          >
            <Wallet className="w-4 h-4" /> Go to Wallet <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="/"
            className="block w-full h-12 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm leading-[3rem] hover:bg-slate-200 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <SuccessInner />
    </Suspense>
  )
}
