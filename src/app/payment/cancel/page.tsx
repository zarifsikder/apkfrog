'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { XCircle, RotateCcw, Home } from 'lucide-react'

function CancelInner() {
  const params = useSearchParams()
  const pid = params.get('pid') || ''

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-100 shadow-xl p-8 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-amber-100 text-amber-600">
          <XCircle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-slate-900 mt-4">Payment Canceled</h1>
        <p className="text-sm text-slate-500 leading-relaxed mt-2">
          The checkout was canceled and no money was charged. You can start again from your Wallet whenever you are ready.
        </p>
        {pid && <p className="text-[11px] font-mono text-slate-300 mt-2">Ref: {pid}</p>}
        <div className="mt-6 space-y-2">
          <a
            href="/?view=wallet"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-900 transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </a>
          <a
            href="/"
            className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors"
          >
            <Home className="w-4 h-4" /> Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}

export default function PaymentCancelPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <CancelInner />
    </Suspense>
  )
}
