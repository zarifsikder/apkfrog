'use client'

import BrandMark from '@/components/wv/BrandMark'

import { useEffect, useState } from 'react'
import { useApp } from '@/lib/store'
import { useWvEvent } from '@/lib/realtime'
import {
  Tag, X, Plus, Trash2, Pencil, Loader2, Tag as TagIcon, Package, Ticket,
  TrendingUp, DollarSign, ShoppingCart, Eye, Star, Copy, Check, ChevronRight, Wallet,
  Sparkles, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import type { MarketplaceListingDTO, MarketplacePurchaseDTO, CouponDTO, ProjectDTO } from '@/lib/types'

type Tab = 'sell' | 'listings' | 'coupons' | 'purchases' | 'sales'

const CATS = ['General', 'Tools', 'Business', 'Lifestyle', 'Templates', 'Personal', 'Education', 'News', 'Gaming', 'UI Kits']
const PREVIEWS = [
  { id: 'gradient', label: 'Gradient' },
  { id: 'dark', label: 'Dark' },
  { id: 'code', label: 'Code' },
  { id: 'none', label: 'Plain' },
]

export default function SellerView({ initialTab = 'sell' }: { initialTab?: Tab }) {
  const { user, setView, showToast } = useApp()
  const [tab, setTab] = useState<Tab>(initialTab)

  // Sell form state
  const [projects, setProjects] = useState<ProjectDTO[]>([])
  const [form, setForm] = useState({
    projectId: '',
    title: '',
    description: '',
    price: '50',
    category: 'General',
    tags: '',
    previewType: 'gradient',
    previewText: '',
    previewSub: '',
  })
  const [creating, setCreating] = useState(false)

  // My data
  const [myListings, setMyListings] = useState<MarketplaceListingDTO[]>([])
  const [myCoupons, setMyCoupons] = useState<CouponDTO[]>([])
  const [myPurchases, setMyPurchases] = useState<MarketplacePurchaseDTO[]>([])
  const [mySales, setMySales] = useState<Array<MarketplacePurchaseDTO & { buyerName: string; earnings: number }>>([])
  const [loading, setLoading] = useState(true)

  // Coupon modal state
  const [couponModal, setCouponModal] = useState<{ listingId?: string } | null>(null)

  const loadProjects = async () => {
    const res = await fetch('/api/projects')
    const d = await res.json()
    setProjects(d.projects || [])
  }

  const loadMyData = async () => {
    try {
      const res = await fetch('/api/marketplace/my')
      const d = await res.json()
      setMyListings(d.listings || [])
      setMyPurchases(d.purchases || [])
      setMySales(d.sales || [])
    } catch {}
    setLoading(false)
  }

  const loadCoupons = async () => {
    const res = await fetch('/api/coupons')
    const d = await res.json()
    setMyCoupons(d.coupons || [])
  }

  useEffect(() => {
    loadProjects()
    loadMyData()
    loadCoupons()
  }, [])

  useWvEvent(['marketplace', 'wallet'], () => {
    loadMyData()
    loadCoupons()
  })

  const publish = async () => {
    if (!form.projectId) { showToast('Pick a project to sell'); return }
    if (form.title.trim().length < 3) { showToast('Title must be at least 3 chars'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (!res.ok) { showToast(d.error || 'Failed to publish'); setCreating(false); return }
      showToast(`"${form.title}" is now live on the Store!`)
      setForm({ projectId: '', title: '', description: '', price: '50', category: 'General', tags: '', previewType: 'gradient', previewText: '', previewSub: '' })
      setTab('listings')
      loadMyData()
    } catch {
      showToast('Failed to publish')
    }
    setCreating(false)
  }

  const deleteListing = async (id: string, title: string) => {
    if (!confirm(`Take down "${title}"? It will no longer be visible on the Store.`)) return
    const res = await fetch(`/api/marketplace/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Listing removed from Store')
      loadMyData()
    } else {
      showToast('Failed to remove listing')
    }
  }

  const toggleListingStatus = async (l: MarketplaceListingDTO) => {
    const newStatus = l.status === 'active' ? 'paused' : 'active'
    const res = await fetch(`/api/marketplace/${l.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      showToast(newStatus === 'active' ? 'Listing is live again' : 'Listing paused')
      loadMyData()
    }
  }

  const deleteCoupon = async (id: string, code: string) => {
    if (!confirm(`Delete coupon "${code}"?`)) return
    const res = await fetch(`/api/coupons/${id}`, { method: 'DELETE' })
    if (res.ok) {
      showToast('Coupon deleted')
      loadCoupons()
    }
  }

  const totalEarnings = mySales.reduce((sum, s) => sum + s.earnings, 0)
  const totalSpent = myPurchases.reduce((sum, p) => sum + p.finalPrice, 0)
  const activeListingCount = myListings.filter((l) => l.status === 'active').length

  return (
    <div className="pb-24 min-h-dvh bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="flex items-center gap-3 px-4 h-16">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center font-black text-white border-2 border-slate-700 shadow-md shadow-slate-900/20">
            <BrandMark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-extrabold tracking-tight text-slate-900">Marketplace</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 -mt-0.5">Sell · Coupons · Purchases</div>
          </div>
          <div className="flex-1" />
          <div className="bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-extrabold text-amber-700">৳{user?.wallet || 0}</span>
          </div>
        </div>
        {/* Tabs */}
        <div className="px-4 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
          {([
            { id: 'sell', label: 'Sell', icon: Tag },
            { id: 'listings', label: 'My Listings', icon: Package },
            { id: 'coupons', label: 'Coupons', icon: Ticket },
            { id: 'purchases', label: 'Purchases', icon: ShoppingCart },
            { id: 'sales', label: 'Sales', icon: TrendingUp },
          ] as const).map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            )
          })}
        </div>
      </header>

      <main className="px-4 pt-5 space-y-5 max-w-2xl mx-auto">
        {/* Stats strip */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatChip icon={Package} color="text-violet-600" bg="bg-violet-50" label="Active Listings" value={String(activeListingCount)} />
          <StatChip icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50" label="Total Sales" value={String(mySales.length)} />
          <StatChip icon={DollarSign} color="text-amber-600" bg="bg-amber-50" label="Earnings" value={`৳${totalEarnings}`} />
          <StatChip icon={ShoppingCart} color="text-sky-600" bg="bg-sky-50" label="Spent" value={`৳${totalSpent}`} />
        </section>

        {/* ───────── Sell tab ───────── */}
        {tab === 'sell' && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" /> List Your Project
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Pick a project, set your price, and start earning.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3.5">
              {/* Project picker */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Project to sell *</label>
                {projects.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl p-4 text-center">
                    <p className="text-xs text-slate-500 mb-2">You have no projects yet.</p>
                    <button onClick={() => setView('home')} className="text-xs font-bold text-violet-600">Create one first →</button>
                  </div>
                ) : (
                  <select
                    value={form.projectId}
                    onChange={(e) => {
                      const p = projects.find((x) => x.id === e.target.value)
                      setForm({
                        ...form,
                        projectId: e.target.value,
                        title: p ? p.name : '',
                        previewText: form.previewText || (p ? p.name.slice(0, 1).toUpperCase() : ''),
                      })
                    }}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
                  >
                    <option value="">— Pick a project —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Listing Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. E-Commerce Android App Template"
                  maxLength={80}
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what your project does, key features, what's included..."
                  maxLength={1000}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white resize-none"
                />
                <div className="text-[10px] text-slate-400 mt-0.5 text-right">{form.description.length}/1000</div>
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Price (৳) *</label>
                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="50"
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">0 = Free. You keep 90% per sale.</div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
                  >
                    {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tags (comma-separated)</label>
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="e.g. ecommerce, kotlin, material-design"
                  maxLength={200}
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white"
                />
              </div>

              {/* Preview type */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Preview Style</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {PREVIEWS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm({ ...form, previewType: p.id })}
                      className={`py-2 rounded-lg text-xs font-bold transition-all ${
                        form.previewType === p.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview text + sub */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Preview Text</label>
                  <input
                    value={form.previewText}
                    onChange={(e) => setForm({ ...form, previewText: e.target.value })}
                    placeholder="📦 or short text"
                    maxLength={80}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Preview Sub</label>
                  <input
                    value={form.previewSub}
                    onChange={(e) => setForm({ ...form, previewSub: e.target.value })}
                    placeholder="subtitle or category"
                    maxLength={80}
                    className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={publish}
                disabled={creating || !form.projectId || form.title.trim().length < 3}
                className="w-full h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white font-extrabold text-sm shadow-lg shadow-violet-500/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                {creating ? 'Publishing...' : 'Publish to Store'}
              </button>
              <p className="text-[10px] text-slate-400 text-center">Platform fee: 10% per sale. You earn 90% instantly into your wallet.</p>
            </div>
          </section>
        )}

        {/* ───────── My Listings tab ───────── */}
        {tab === 'listings' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">My Listings</h2>
              <button onClick={() => setTab('sell')} className="text-xs font-bold text-violet-600 flex items-center gap-0.5">
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
            {loading ? (
              <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}</div>
            ) : myListings.length === 0 ? (
              <EmptyState icon={Package} title="No listings yet" desc="Publish your first project and start earning from sales." cta="Publish a Project" onCta={() => setTab('sell')} />
            ) : (
              myListings.map((l) => (
                <div key={l.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl shrink-0">
                      {l.previewText || '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-slate-900 truncate flex-1">{l.title}</h3>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          l.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                          l.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>{l.status.toUpperCase()}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-semibold">
                        <span className="text-violet-600 font-extrabold">৳{l.price}</span>
                        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" /> {l.views}</span>
                        <span className="flex items-center gap-0.5"><ShoppingCart className="w-3 h-3" /> {l.salesCount}</span>
                        {l.rating > 0 && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {l.rating.toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => toggleListingStatus(l)}
                      className={`flex-1 h-9 rounded-lg text-xs font-bold transition-colors ${
                        l.status === 'active' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {l.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => setCouponModal({ listingId: l.id })}
                      className="flex-1 h-9 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold hover:bg-violet-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <Ticket className="w-3.5 h-3.5" /> Coupon
                    </button>
                    <button
                      onClick={() => deleteListing(l.id, l.title)}
                      className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors flex items-center justify-center"
                      aria-label="Delete listing"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>
        )}

        {/* ───────── Coupons tab ───────── */}
        {tab === 'coupons' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">My Coupons</h2>
              <button onClick={() => setCouponModal({})} className="text-xs font-bold text-violet-600 flex items-center gap-0.5">
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
            <div className="bg-violet-50/50 border border-violet-100 rounded-2xl p-3.5">
              <p className="text-[11px] text-violet-700 font-semibold leading-snug">
                💡 Coupons give buyers a discount on your listings. Create codes like <span className="font-mono font-bold">SUMMER20</span> for 20% off, share them with customers, and watch your sales grow!
              </p>
            </div>
            {myCoupons.length === 0 ? (
              <EmptyState icon={Ticket} title="No coupons yet" desc="Create coupon codes to offer discounts and attract more buyers." cta="Create Coupon" onCta={() => setCouponModal({})} />
            ) : (
              myCoupons.map((c) => (
                <CouponCard key={c.id} coupon={c} onDelete={() => deleteCoupon(c.id, c.code)} />
              ))
            )}
          </section>
        )}

        {/* ───────── Purchases tab ───────── */}
        {tab === 'purchases' && (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">My Purchases</h2>
            {loading ? (
              <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}</div>
            ) : myPurchases.length === 0 ? (
              <EmptyState icon={ShoppingCart} title="No purchases yet" desc="Browse the marketplace and buy projects from other builders." cta="Browse Store" onCta={() => setView('store')} />
            ) : (
              myPurchases.map((p) => (
                <PurchaseCard key={p.id} purchase={p} />
              ))
            )}
          </section>
        )}

        {/* ───────── Sales tab ───────── */}
        {tab === 'sales' && (
          <section className="space-y-3">
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900">My Sales</h2>
            {loading ? (
              <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}</div>
            ) : mySales.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No sales yet" desc="Publish great projects, share coupon codes, and your first sale will appear here." cta="List a Project" onCta={() => setTab('sell')} />
            ) : (
              mySales.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{s.listingTitle}</h3>
                      <div className="text-[11px] text-slate-500 mt-0.5">Bought by <span className="font-bold text-slate-700">{s.buyerName}</span></div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{new Date(s.createdAt).toLocaleDateString()} · {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-0.5 justify-end">
                        <ArrowDownRight className="w-3 h-3" /> Earned
                      </div>
                      <div className="text-lg font-extrabold text-emerald-600">৳{s.earnings}</div>
                      {s.discount > 0 && (
                        <div className="text-[9px] text-slate-400">of ৳{s.finalPrice} (after coupon & fee)</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>

      {/* Coupon create modal */}
      {couponModal && (
        <CouponModal
          listings={myListings}
          defaultListingId={couponModal.listingId}
          onClose={() => setCouponModal(null)}
          onCreated={() => { loadCoupons(); setCouponModal(null) }}
        />
      )}
    </div>
  )
}

/* ---------------- Helpers ---------------- */

function StatChip({ icon: Icon, color, bg, label, value }: { icon: typeof Tag; color: string; bg: string; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-col gap-1">
      <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="font-extrabold text-base text-slate-900 leading-tight">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, desc, cta, onCta }: { icon: typeof Tag; title: string; desc: string; cta: string; onCta: () => void }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="font-extrabold text-slate-700 text-sm">{title}</h3>
      <p className="text-xs text-slate-400 mt-1 max-w-xs">{desc}</p>
      <button onClick={onCta} className="mt-3 bg-violet-600 text-white font-bold text-xs px-4 py-2 rounded-full hover:bg-violet-700 transition-colors">
        {cta}
      </button>
    </div>
  )
}

function CouponCard({ coupon, onDelete }: { coupon: CouponDTO; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(coupon.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date()
  const isExhausted = coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses
  const isActive = coupon.active && !isExpired && !isExhausted

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
          <Ticket className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={copy} className="font-mono font-extrabold text-base text-slate-900 tracking-wider hover:text-violet-600 transition-colors flex items-center gap-1.5">
              {coupon.code}
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
            </button>
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
              isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>{isActive ? 'ACTIVE' : isExpired ? 'EXPIRED' : isExhausted ? 'USED UP' : 'PAUSED'}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-semibold">
            <span className="text-amber-600 font-extrabold">{coupon.discountPercent}% OFF</span>
            <span>Used: {coupon.usedCount}{coupon.maxUses > 0 ? `/${coupon.maxUses}` : ''}</span>
            {coupon.listingTitle && <span className="truncate">For: {coupon.listingTitle}</span>}
          </div>
          {coupon.expiresAt && (
            <div className="text-[10px] text-slate-400 mt-0.5">Expires: {new Date(coupon.expiresAt).toLocaleDateString()}</div>
          )}
        </div>
        <button
          onClick={onDelete}
          className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors flex items-center justify-center shrink-0"
          aria-label="Delete coupon"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

function PurchaseCard({ purchase }: { purchase: MarketplacePurchaseDTO }) {
  const { openEditor, showToast } = useApp()
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center text-xl shrink-0">
          {purchase.previewText || '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-slate-900 truncate">{purchase.listingTitle}</h3>
          <div className="text-[11px] text-slate-500 mt-0.5">From <span className="font-bold text-slate-700">{purchase.sellerName}</span></div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs font-extrabold text-slate-900">৳{purchase.finalPrice}</span>
            {purchase.discount > 0 && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Saved ৳{purchase.discount}</span>
            )}
            {purchase.couponCode && (
              <span className="text-[10px] font-mono font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">{purchase.couponCode}</span>
            )}
            <span className="text-[10px] text-slate-400 ml-auto">{new Date(purchase.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => openEditor({ id: purchase.projectId, name: purchase.projectName, type: 'html', createdAt: '', updatedAt: '' })}
        className="w-full mt-3 h-9 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
      >
        <Pencil className="w-3.5 h-3.5" /> Open in Editor
      </button>
    </div>
  )
}

function CouponModal({ listings, defaultListingId, onClose, onCreated }: {
  listings: MarketplaceListingDTO[]
  defaultListingId?: string
  onClose: () => void
  onCreated: () => void
}) {
  const { showToast } = useApp()
  const [code, setCode] = useState('')
  const [discountPercent, setDiscountPercent] = useState('10')
  const [maxUses, setMaxUses] = useState('0')
  const [expiresAt, setExpiresAt] = useState('')
  const [listingId, setListingId] = useState(defaultListingId || '')
  const [creating, setCreating] = useState(false)

  const create = async () => {
    if (Number(discountPercent) < 1 || Number(discountPercent) > 100) {
      showToast('Discount must be 1-100%')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim() || undefined,
          discountPercent: Number(discountPercent),
          maxUses: Number(maxUses),
          expiresAt: expiresAt || null,
          listingId: listingId || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) { showToast(d.error || 'Failed to create coupon'); setCreating(false); return }
      showToast(`Coupon ${d.coupon.code} created!`)
      onCreated()
    } catch {
      showToast('Failed to create coupon')
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl shadow-2xl p-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Ticket className="w-4 h-4 text-amber-500" /> Create Coupon
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Code (leave empty to auto-generate)</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. SUMMER20"
              maxLength={30}
              className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono font-bold tracking-wider text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Discount %</label>
              <input
                type="number"
                min="1"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Max Uses (0=∞)</label>
              <input
                type="number"
                min="0"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Expires (optional)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Applies To</label>
            <select
              value={listingId}
              onChange={(e) => setListingId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-violet-500 focus:bg-white"
            >
              <option value="">All my listings</option>
              {listings.map((l) => (
                <option key={l.id} value={l.id}>{l.title}</option>
              ))}
            </select>
          </div>
          <button
            onClick={create}
            disabled={creating}
            className="w-full h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-900 font-extrabold text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}
            {creating ? 'Creating...' : 'Create Coupon'}
          </button>
        </div>
      </div>
    </div>
  )
}
