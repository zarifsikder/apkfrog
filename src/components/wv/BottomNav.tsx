'use client'

import { useApp } from '@/lib/store'
import { Home, Store, Tag, Menu } from 'lucide-react'
import type { ViewName } from '@/lib/types'

const NAV: { view: ViewName | 'more'; label: string; icon: typeof Home }[] = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'store', label: 'Store', icon: Store },
  { view: 'seller', label: 'Sell', icon: Tag },
  { view: 'more', label: 'More', icon: Menu },
]

export default function BottomNav() {
  const { view, setView, setShowMore, showMore } = useApp()
  if (view === 'editor') return null
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/85 backdrop-blur-xl border-t border-slate-100" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-3xl mx-auto grid grid-cols-4 h-16">
        {NAV.map((n) => {
          const active = n.view === 'more' ? showMore : view === n.view
          const Icon = n.icon
          return (
            <button key={n.view} onClick={() => (n.view === 'more' ? setShowMore(true) : setView(n.view))} className="group relative flex flex-col items-center justify-center gap-0.5 transition-colors" aria-current={active ? 'page' : undefined}>
              {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" />}
              <Icon className={`w-5 h-5 transition-all ${active ? 'text-violet-600 scale-110' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={active ? 2.4 : 2} />
              <span className={`text-[11px] transition-colors ${active ? 'font-extrabold text-violet-600' : 'font-medium text-slate-400'}`}>{n.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
