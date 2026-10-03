'use client'

import BrandMark from '@/components/wv/BrandMark'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { useWvEvent } from '@/lib/realtime'
import {
  Search, Bell, SearchX, Rocket, ShieldCheck, DollarSign, Trophy, Share2, Eye,
  Tag, X, Sparkles, TrendingUp, Star, ChevronRight, Wallet, Loader2, CheckCircle2, Ticket, Download,
} from 'lucide-react'
import type { MarketplaceListingDTO } from '@/lib/types'

const CATS = ['All', 'Tools', 'Business', 'Lifestyle', 'Templates', 'Personal', 'Education', 'News', 'Gaming', 'UI Kits']
const SORTS = [
  { id: 'newest', label: 'Newest' },
  { id: 'popular', label: 'Popular' },
  { id: 'price_low', label: 'Price: Low to High' },
  { id: 'price_high', label: 'Price: High to Low' },
  { id: 'rating', label: 'Top Rated' },
]

export default function StoreView() {
  const { user, setView, showToast } = useApp()
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('All')
  const [sort, setSort] = useState('newest')
  const [listings, setListings] = useState<MarketplaceListingDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<MarketplaceListingDTO | null>(null)

  const load = async () => {
    try {
      const res = await fetch(`/api/marketplace?q=${encodeURIComponent(query)}&category=${encodeURIComponent(cat)}&sort=${sort}`)
      const data = await res.json()
      setListings(data.listings || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, cat, sort])

  // Real-time: refresh when any listing changes anywhere
  useWvEvent(['marketplace', 'wallet'], () => load())

  return (
    <div className="pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white border-2 border-slate-700 shadow-md shadow-slate-900/20">
            <BrandMark className="w-5 h-5" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-slate-900">APKFORGE</span>
          <div className="flex-1" />
          <button onClick={() => setView('notifications')} className="relative w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200" aria-label="Notifications">
            <Bell className="w-4 h-4" />
          </button>
        </div>
        {/* Category chips */}
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                cat === c ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-4 space-y-5 max-w-2xl mx-auto">
        {/* Hero banner — Sell your projects */}
        <section className="rounded-3xl overflow-hidden shadow-lg relative bg-gradient-to-br from-slate-900 via-slate-900 to-violet-950 p-5 text-white">
          <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at 80% 20%, #e879f9 0%, transparent 50%), radial-gradient(circle at 10% 90%, #818cf8 0%, transparent 40%)' }} />
          <div className="relative flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold tracking-widest text-violet-300 mb-1 flex items-center gap-1">
                <Tag className="w-3 h-3" /> MARKETPLACE
              </div>
              <h2 className="text-xl font-black leading-tight">Buy &amp; Sell<br />Real Projects</h2>
              <p className="text-[12px] text-violet-100/80 mt-1.5 max-w-[230px] leading-snug">
                List your projects, set your price, create coupon codes &amp; earn from every sale.
              </p>
              <button
                onClick={() => setView('seller')}
                className="mt-3 inline-flex items-center gap-1.5 bg-white text-slate-900 text-xs font-black px-4 py-2 rounded-full hover:bg-violet-50 active:scale-95 transition-transform"
              >
                <Tag className="w-3.5 h-3.5" /> Start Selling
              </button>
            </div>
            <div className="hidden sm:flex flex-col gap-2 shrink-0">
              <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-3 py-2">
                <div className="text-[9px] font-bold uppercase tracking-wider text-violet-200">Your Wallet</div>
                <div className="text-lg font-black text-white">৳{user?.wallet || 0}</div>
              </div>
              <button onClick={() => setView('purchases')} className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-3 py-2 text-left hover:bg-white/15 transition-colors">
                <div className="text-[9px] font-bold uppercase tracking-wider text-violet-200">My Purchases</div>
                <div className="text-xs font-black text-white flex items-center gap-1">View <ChevronRight className="w-3 h-3" /></div>
              </button>
            </div>
          </div>
        </section>

        {/* Sort + count */}
        <section>
          {/* Search bar — sits above the product list */}
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, sellers, tags..."
              aria-label="Search marketplace"
              className="w-full h-12 pl-11 pr-10 rounded-2xl bg-white border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10 transition-all shadow-sm"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-500" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between mb-3 gap-2">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> Marketplace
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">{loading ? '...' : `${listings.length} items`}</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-slate-100 border-0 rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer"
              >
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 py-16 flex flex-col items-center text-center px-8">
              <SearchX className="w-14 h-14 text-slate-300 mb-4" />
              <h3 className="font-extrabold text-slate-700 text-lg">No projects found</h3>
              <p className="text-slate-400 text-sm mt-1 max-w-xs">Try a different keyword, or be the first to list a project in this category.</p>
              <button onClick={() => setView('seller')} className="mt-4 inline-flex items-center gap-1.5 bg-violet-600 text-white font-bold text-sm px-5 py-2.5 rounded-full hover:bg-violet-700">
                <Tag className="w-4 h-4" /> List Your Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {listings.map((l) => {
                const isOwn = l.sellerId === user?.id
                return (
                  <button
                    key={l.id}
                    onClick={() => setActive(l)}
                    className="text-left rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-violet-200 transition-all overflow-hidden group"
                  >
                    <ListingPreview l={l} />
                    <div className="p-3">
                      <div className="font-bold text-sm text-slate-900 truncate">{l.title}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 min-h-[28px]">{l.description || 'No description'}</div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-[9px] font-extrabold shrink-0">{l.sellerInitials}</div>
                          <span className="text-xs text-slate-500 truncate">{isOwn ? 'You' : l.sellerName}</span>
                        </div>
                        <div className="flex items-center gap-0.5 text-[10px] text-slate-400">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {l.rating > 0 ? l.rating.toFixed(1) : 'New'}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
                        <span className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Eye className="w-3 h-3" /> {l.views} · {l.salesCount} sold
                        </span>
                        {l.price === 0 ? (
                          <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">Free</span>
                        ) : (
                          <span className="text-xs font-extrabold text-slate-900 bg-violet-50 px-2.5 py-1 rounded-full">৳{l.price}</span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* Listing detail modal */}
      {active && (
        <ListingDetail
          listing={active}
          onClose={() => setActive(null)}
          onChanged={() => { load(); setActive(null) }}
        />
      )}
    </div>
  )
}

/* ---------------- Sub-components ---------------- */

function ListingPreview({ l, tall = false }: { l: MarketplaceListingDTO; tall?: boolean }) {
  const h = tall ? 'h-40' : 'h-28'
  if (l.previewType === 'dark') {
    return (
      <div className={`${h} relative bg-[#0b1020] overflow-hidden`}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(56,189,248,.15), transparent 50%), radial-gradient(ellipse at 75% 80%, rgba(168,85,247,.15), transparent 45%)' }} />
        {[...Array(14)].map((_, i) => (
          <span key={i} className="absolute w-0.5 h-0.5 bg-white/60 rounded-full" style={{ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }} />
        ))}
        <div className="absolute inset-0 flex items-center justify-center text-2xl">{l.previewText || '📦'}</div>
      </div>
    )
  }
  if (l.previewType === 'code') {
    return (
      <div className={`${h} bg-slate-50 p-4 overflow-hidden`}>
        <div className="font-serif font-bold text-xl text-slate-900 leading-tight truncate">{l.previewText || l.title}</div>
        <div className="font-mono text-xs text-slate-500 mt-2 truncate">{l.previewSub || '<html>...'}</div>
        <div className="font-mono text-[10px] text-slate-300 mt-1">&lt;body&gt; ...</div>
      </div>
    )
  }
  if (l.previewType === 'gradient') {
    return (
      <div className={`${h} bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex flex-col items-center justify-center gap-1.5`}>
        <span className="text-3xl">{l.previewText || '📦'}</span>
        <span className="text-white font-bold text-xs drop-shadow truncate max-w-[80%]">{l.previewSub || l.category}</span>
      </div>
    )
  }
  return (
    <div className={`${h} bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-1.5`}>
      <span className="text-3xl">📦</span>
      <span className="text-slate-500 font-bold text-xs">No Preview</span>
    </div>
  )
}

function ListingDetail({ listing, onClose, onChanged }: {
  listing: MarketplaceListingDTO
  onClose: () => void
  onChanged: () => void
}) {
  const { user, showToast, openEditor, setUser, setView } = useApp()
  const [couponCode, setCouponCode] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number; discountAmount: number; finalPrice: number; originalPrice: number } | null>(null)
  const [validating, setValidating] = useState(false)
  const [buying, setBuying] = useState(false)

  const isOwn = listing.sellerId === user?.id
  const finalPrice = appliedCoupon?.finalPrice ?? listing.price
  const discountAmount = appliedCoupon?.discountAmount ?? 0

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    setValidating(true)
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim(), listingId: listing.id }),
      })
      const data = await res.json()
      if (data.valid) {
        setAppliedCoupon({
          code: data.code,
          discountPercent: data.discountPercent,
          discountAmount: data.discountAmount,
          finalPrice: data.finalPrice,
          originalPrice: data.originalPrice,
        })
        showToast(`Coupon applied — saved ৳${data.discountAmount}`)
      } else {
        showToast(data.reason || 'Invalid coupon')
        setAppliedCoupon(null)
      }
    } catch {
      showToast('Failed to validate coupon')
    }
    setValidating(false)
  }

  const buy = async () => {
    setBuying(true)
    try {
      const res = await fetch(`/api/marketplace/${listing.id}/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ couponCode: appliedCoupon?.code || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(data.error || 'Purchase failed')
        setBuying(false)
        return
      }
      if (data.wallet !== undefined && setUser) {
        setUser({ ...user!, wallet: data.wallet })
      }
      showToast(`✓ "${listing.title}" added to your projects!`)
      onChanged()
    } catch {
      showToast('Purchase failed')
    }
    setBuying(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Preview header */}
        <div className="relative">
          <ListingPreview l={listing} tall />
          <button onClick={onClose} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-slate-700 hover:bg-white shadow-md">
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded-md">{listing.category}</span>
            {listing.price === 0 ? (
              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-md">FREE</span>
            ) : (
              <span className="bg-violet-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">৳{listing.price}</span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Title + seller */}
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">{listing.title}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="w-7 h-7 rounded-full bg-violet-50 text-violet-700 flex items-center justify-center text-[10px] font-extrabold">{listing.sellerInitials}</div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-700">{isOwn ? 'You' : listing.sellerName}</div>
                <div className="text-[10px] text-slate-400">{listing.salesCount} sales · {listing.views} views</div>
              </div>
              {listing.rating > 0 && (
                <div className="ml-auto flex items-center gap-1 text-xs font-bold text-amber-600">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {listing.rating.toFixed(1)}
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{listing.description}</div>
          )}

          {/* Tags */}
          {listing.tags && (
            <div className="flex flex-wrap gap-1.5">
              {listing.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6).map((t, i) => (
                <span key={i} className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">#{t}</span>
              ))}
            </div>
          )}

          {/* Coupon section — only for buyers */}
          {!isOwn && listing.price > 0 && (
            <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-violet-700 mb-2">
                <Ticket className="w-3.5 h-3.5" /> Have a coupon code?
              </div>
              <div className="flex gap-2">
                <input
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setAppliedCoupon(null) }}
                  placeholder="ENTER CODE"
                  className="flex-1 h-10 px-3 rounded-lg bg-white border border-violet-200 text-sm font-mono font-bold tracking-wider text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500"
                />
                <button
                  onClick={applyCoupon}
                  disabled={!couponCode.trim() || validating || !!appliedCoupon}
                  className="h-10 px-4 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : appliedCoupon ? <CheckCircle2 className="w-4 h-4" /> : 'Apply'}
                </button>
              </div>
              {appliedCoupon && (
                <div className="mt-2 text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> {appliedCoupon.code} — {appliedCoupon.discountPercent}% off (saved ৳{appliedCoupon.discountAmount})
                </div>
              )}
            </div>
          )}

          {/* Price summary */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Price</span>
              <span>৳{listing.price}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 font-semibold">
                <span>Coupon discount</span>
                <span>−৳{discountAmount}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
              <span className="text-sm font-extrabold text-slate-900">Total</span>
              <span className="text-lg font-extrabold text-slate-900">৳{finalPrice}</span>
            </div>
            {user && (
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-1">
                <span className="flex items-center gap-1"><Wallet className="w-3 h-3" /> Your wallet</span>
                <span className={user.wallet >= finalPrice ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>৳{user.wallet}</span>
              </div>
            )}
          </div>

          {/* Action */}
          {isOwn ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-center">
              <div className="text-xs font-bold text-amber-700">This is your own listing</div>
              <button
                onClick={() => { openEditor({ id: listing.projectId, name: listing.title, type: 'html', createdAt: '', updatedAt: '' }); onClose() }}
                className="mt-2 w-full h-11 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800"
              >
                Open Project in Editor
              </button>
            </div>
          ) : listing.price === 0 ? (
            <button
              onClick={buy}
              disabled={buying}
              className="w-full h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-extrabold text-sm shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {buying ? 'Adding...' : 'Get Free Project'}
            </button>
          ) : user && user.wallet < finalPrice ? (
            <div className="space-y-2">
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-center">
                <div className="text-xs font-bold text-rose-700">Insufficient wallet balance</div>
                <div className="text-[11px] text-rose-500 mt-0.5">You need ৳{finalPrice - (user?.wallet || 0)} more to buy this project.</div>
              </div>
              <button
                onClick={() => setView('wallet')}
                className="w-full h-12 rounded-2xl bg-amber-400 text-slate-900 font-extrabold text-sm hover:bg-amber-300 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Wallet className="w-4 h-4" /> Top Up Wallet
              </button>
            </div>
          ) : (
            <button
              onClick={buy}
              disabled={buying}
              className="w-full h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-extrabold text-sm shadow-lg shadow-violet-500/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              {buying ? 'Processing...' : `Buy Now — ৳${finalPrice}`}
            </button>
          )}

          <div className="flex items-center justify-center gap-4 pt-1 text-[10px] text-slate-400 font-semibold">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Secure</span>
            <span className="flex items-center gap-1"><Rocket className="w-3 h-3" /> Instant delivery</span>
            <span className="flex items-center gap-1"><Trophy className="w-3 h-3" /> Quality checked</span>
          </div>
        </div>
      </div>
    </div>
  )
}
