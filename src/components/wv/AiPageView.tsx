'use client'

import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/lib/store'
import type { ProjectDTO, ViewName } from '@/lib/types'
import {
  Send, Bot, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Plus,
  History, Trash2, MessageSquare, X, Sparkles, Zap, ChevronRight,
} from 'lucide-react'

/**
 * AI Assistant full-page view — clean, minimal, user-friendly.
 *
 * - Conversation history persists to localStorage (key: apkforge_ai_chats).
 *   Sidebar shows every saved conversation; click to switch, delete with one
 *   button. New chat button creates a fresh conversation.
 * - Each conversation keeps its own messages; switching chats loads the
 *   right one instantly.
 * - Same backend as before (POST /api/ai/chat with GLM-5.2 + 16 tools).
 * - Welcome screen shows 4 quick-start cards only when the active chat is
 *   empty — no clutter once you've started talking.
 * - Tool badges inline so you can see what the AI did.
 */

type Role = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: Role
  content: string
  toolLog?: { name: string; summary: string; ok: boolean }[]
  pending?: boolean
}

interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

type UiAction =
  | { type: 'navigate'; view: string }
  | { type: 'open_editor'; project: { id: string; name: string; type: string } }
  | { type: 'toast'; message: string }
  | { type: 'refresh_projects' }
  | { type: 'refresh_builds' }
  | { type: 'open_build'; source: { type: 'html' | 'kotlin'; projectId?: string } }

const STORAGE_KEY = 'apkforge_ai_chats_v1'
const MAX_CHATS = 30

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `m${Date.now()}-${idCounter}`
}

function newConversation(): Conversation {
  return {
    id: `c${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: 'New chat',
    messages: [],
    updatedAt: Date.now(),
  }
}

/* load + save chats from localStorage */
function loadChats(): Conversation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c) => c && c.id && Array.isArray(c.messages))
  } catch {
    return []
  }
}

function saveChats(chats: Conversation[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_CHATS)))
  } catch { /* quota exceeded — silently ignore */ }
}

const RECIPES: { title: string; prompt: string; emoji: string; tint: string; bg: string }[] = [
  { title: 'Calculator', prompt: 'একটা calculator app বানাও', emoji: '🧮', tint: 'text-violet-600', bg: 'bg-violet-50' },
  { title: 'To-Do List', prompt: 'আমার জন্য একটা to-do list app বানাও', emoji: '✅', tint: 'text-emerald-600', bg: 'bg-emerald-50' },
  { title: 'Notes', prompt: 'notes app বানাও আমার জন্য', emoji: '📝', tint: 'text-amber-600', bg: 'bg-amber-50' },
  { title: 'Weather UI', prompt: 'weather app বানাও আমার জন্য', emoji: '🌤️', tint: 'text-sky-600', bg: 'bg-sky-50' },
]

function ToolBadge({ entry }: { entry: { name: string; summary: string; ok: boolean } }) {
  return (
    <div className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-200/70">
      <span className={`shrink-0 ${entry.ok ? 'text-emerald-500' : 'text-rose-500'}`}>
        {entry.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
      </span>
      <span className="font-mono text-[11px] font-semibold text-violet-600 shrink-0">{entry.name}</span>
      <span className="text-slate-700 break-words leading-snug">{entry.summary}</span>
    </div>
  )
}

function Avatar({ role }: { role: Role }) {
  if (role === 'user') {
    return (
      <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center text-xs font-bold shrink-0">U</div>
    )
  }
  return (
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white flex items-center justify-center shrink-0">
      <Bot className="w-4 h-4" />
    </div>
  )
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function AiPageView() {
  const { user, setView, openEditor, openBuild, showToast, goBack } = useApp()
  const [chats, setChats] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load chats on mount; create a new one if none exist
  useEffect(() => {
    const stored = loadChats()
    if (stored.length > 0) {
      setChats(stored)
      setActiveId(stored[0].id)
    } else {
      const fresh = newConversation()
      setChats([fresh])
      setActiveId(fresh.id)
    }
  }, [])

  // Persist whenever chats change
  useEffect(() => {
    if (chats.length > 0) saveChats(chats)
  }, [chats])

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [chats, activeId])

  const active = chats.find((c) => c.id === activeId) || null
  const messages = active?.messages || []
  const isEmpty = messages.length === 0

  function patchActive(updater: (c: Conversation) => Conversation) {
    setChats((prev) => prev.map((c) => (c.id === activeId ? updater(c) : c)))
  }

  function startNewChat() {
    const fresh = newConversation()
    setChats((prev) => [fresh, ...prev].slice(0, MAX_CHATS))
    setActiveId(fresh.id)
    setInput('')
    setSidebarOpen(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function deleteChat(id: string) {
    setChats((prev) => {
      const remaining = prev.filter((c) => c.id !== id)
      if (remaining.length === 0) {
        const fresh = newConversation()
        setActiveId(fresh.id)
        return [fresh]
      }
      if (id === activeId) setActiveId(remaining[0].id)
      return remaining
    })
  }

  function clearCurrentChat() {
    if (messages.length === 0) return
    if (!confirm('এই চ্যাট clear করতে চান? এটা undo করা যাবে না।')) return
    patchActive((c) => ({ ...c, messages: [], title: 'New chat', updatedAt: Date.now() }))
    showToast('Chat cleared')
  }

  function applyActions(actions: UiAction[] | undefined) {
    if (!actions || !actions.length) return
    for (const a of actions) {
      switch (a.type) {
        case 'navigate': {
          const valid: ViewName[] = ['home', 'store', 'editor', 'build', 'console', 'ready', 'profile', 'wallet', 'payments', 'subscription', 'referrals', 'notifications', 'push', 'appDownload', 'adminPanel', 'seller', 'purchases', 'ai']
          if (valid.includes(a.view as ViewName)) setView(a.view as ViewName)
          break
        }
        case 'open_editor': {
          const p = a.project
          const project: ProjectDTO = {
            id: p.id, name: p.name, type: p.type as ProjectDTO['type'],
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          }
          openEditor(project)
          break
        }
        case 'open_build': openBuild(a.source); break
        case 'toast': showToast(a.message); break
        case 'refresh_projects':
        case 'refresh_builds': break
      }
    }
  }

  async function send(messageText: string) {
    const text = messageText.trim()
    if (!text || sending || !active) return

    // Compose history from the active conversation's prior messages
    const history = messages
      .filter((m) => !m.pending && m.content)
      .slice(-14)
      .map((m) => ({ role: m.role, content: m.content }))

    const userMsg: ChatMessage = { id: nextId(), role: 'user', content: text }
    const pendingMsg: ChatMessage = { id: nextId(), role: 'assistant', content: '', pending: true }

    // Auto-title the chat from the first user message
    const newTitle = messages.length === 0 ? text.slice(0, 40) + (text.length > 40 ? '…' : '') : active.title

    patchActive((c) => ({
      ...c,
      title: newTitle,
      messages: [...c.messages, userMsg, pendingMsg],
      updatedAt: Date.now(),
    }))
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data: { reply?: string; actions?: UiAction[]; toolLog?: { name: string; summary: string; ok: boolean }[]; error?: string } = await res.json()
      if (!res.ok) {
        const errText = data.error || `Request failed (${res.status})`
        patchActive((c) => ({
          ...c,
          messages: c.messages.map((m) => (m.id === pendingMsg.id ? { ...m, pending: false, content: `⚠️ ${errText}` } : m)),
        }))
        return
      }
      patchActive((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === pendingMsg.id
          ? { ...m, pending: false, content: data.reply || '...', toolLog: data.toolLog }
          : m)),
        updatedAt: Date.now(),
      }))
      applyActions(data.actions)
    } catch (e) {
      const msg = (e as Error).message || 'Network error'
      patchActive((c) => ({
        ...c,
        messages: c.messages.map((m) => (m.id === pendingMsg.id ? { ...m, pending: false, content: `⚠️ Network error: ${msg}` } : m)),
      }))
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    send(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2.5">
          <button
            onClick={() => goBack()}
            aria-label="Back"
            className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4.5 h-4.5" />
          </button>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-sm shrink-0">
            <Bot className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-slate-900 tracking-tight flex items-center gap-1.5 text-sm">
              Forge AI
              <span className="text-[9px] font-bold tracking-wider uppercase text-violet-700 bg-violet-50 border border-violet-200/60 px-1.5 py-0.5 rounded-full">GLM-5.2</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">{active?.title || 'New chat'}</div>
          </div>
          <button
            onClick={startNewChat}
            aria-label="New chat"
            title="New chat"
            className="w-9 h-9 rounded-full hover:bg-violet-50 hover:text-violet-600 flex items-center justify-center text-slate-600 transition-colors"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={clearCurrentChat}
            aria-label="Clear current chat"
            title="Clear chat"
            className="w-9 h-9 rounded-full hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Chat history"
            title="History"
            className="md:hidden w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-colors relative"
          >
            <History className="w-4.5 h-4.5" />
            {chats.length > 1 && (
              <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-violet-500" />
            )}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 max-w-6xl w-full mx-auto flex min-h-0 px-0 md:px-4 py-0 md:py-4 gap-0 md:gap-4">
        {/* Sidebar — desktop persistent, mobile slide-over */}
        <aside
          className={`md:w-64 md:shrink-0 ${sidebarOpen ? 'fixed inset-0 z-40' : 'hidden md:block'}`}
          onClick={() => setSidebarOpen(false)}
        >
          <div
            className="md:sticky md:top-[4.5rem] h-full md:h-auto md:max-h-[calc(100vh-7rem)] md:overflow-y-auto bg-white md:bg-white/70 md:backdrop-blur md:rounded-2xl md:border md:border-slate-100 md:shadow-sm p-3 w-[82%] max-w-xs ml-auto md:ml-0 md:w-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2.5 px-1">
              <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-violet-500" /> History
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="md:hidden w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={startNewChat}
              disabled={sending}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 hover:bg-violet-100 border border-violet-100 text-violet-700 text-sm font-semibold transition-colors mb-2.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> New chat
            </button>

            <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
              {chats.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-4">No chats yet</div>
              ) : (
                chats.map((c) => {
                  const isActive = c.id === activeId
                  return (
                    <div
                      key={c.id}
                      onClick={() => { setActiveId(c.id); setSidebarOpen(false) }}
                      className={`group cursor-pointer rounded-lg px-2.5 py-2 transition-colors flex items-center gap-2 ${
                        isActive ? 'bg-violet-50 border border-violet-100' : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-violet-600' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-semibold truncate ${isActive ? 'text-violet-800' : 'text-slate-700'}`}>
                          {c.title || 'New chat'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {c.messages.length} msg{c.messages.length !== 1 ? 's' : ''} · {timeAgo(c.updatedAt)}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteChat(c.id) }}
                        aria-label="Delete chat"
                        className="shrink-0 w-6 h-6 rounded-md hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center text-slate-300 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 px-1">
              <div className="text-[10px] text-slate-400 leading-relaxed">
                Chats saved on this device only (localStorage).
              </div>
            </div>
          </div>
        </aside>

        {/* Chat panel */}
        <main className="flex-1 min-w-0 flex flex-col bg-white md:border md:border-slate-100 md:rounded-2xl md:shadow-sm overflow-hidden min-h-[calc(100vh-3.5rem)] md:min-h-[calc(100vh-6.5rem)]">
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            {isEmpty ? (
              <WelcomeScreen onPick={(p) => send(p)} disabled={sending} userName={user?.name} />
            ) : (
              <div className="max-w-3xl mx-auto px-4 md:px-6 py-5 space-y-5">
                {messages.map((m) => (
                  <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <Avatar role={m.role} />
                    <div className={`flex-1 min-w-0 ${m.role === 'user' ? 'flex flex-col items-end' : ''}`}>
                      {m.pending ? (
                        <div className="inline-flex items-center gap-2 text-slate-500 text-sm bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-md px-4 py-2.5">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-xs">Forge ভাবছি...</span>
                        </div>
                      ) : (
                        <div className={m.role === 'user'
                          ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed shadow-sm max-w-full inline-block'
                          : 'bg-slate-50 border border-slate-200/70 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-slate-800 leading-relaxed max-w-full inline-block'
                        }>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          {m.toolLog && m.toolLog.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 space-y-1">
                              <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1">
                                <Zap className="w-2.5 h-2.5" /> Tools
                              </div>
                              {m.toolLog.map((t, i) => <ToolBadge key={i} entry={t} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 bg-white">
            <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 md:px-6 py-3">
              <div className="flex items-end gap-2 rounded-2xl bg-slate-50 border border-slate-200 focus-within:border-violet-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-100 transition-all px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  placeholder="Forge কে কিছু বলুন..."
                  className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none max-h-40 py-1"
                  style={{ minHeight: '24px' }}
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform shrink-0"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                Enter দিলে send · Shift+Enter দিলে newline
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}

/* Welcome screen — minimal, friendly, no clutter */
function WelcomeScreen({
  onPick, disabled, userName,
}: { onPick: (prompt: string) => void; disabled: boolean; userName?: string }) {
  const firstName = (userName || '').split(' ')[0] || 'there'
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
      <div className="text-center mb-8">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 items-center justify-center text-white shadow-lg shadow-fuchsia-500/20 mb-3">
          <Sparkles className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          আসসালামু আলাইকুম, {firstName} 👋
        </h1>
        <p className="text-slate-600 mt-2 text-sm leading-relaxed max-w-md mx-auto">
          আমি <span className="font-semibold text-violet-600">Forge</span> — আপনার ApkForge AI assistant. যা বলবেন সেটাই করবো। নিচের যেকোনো একটা দিয়ে শুরু করুন, অথবা নিজে কিছু লিখুন।
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {RECIPES.map((r) => (
          <button
            key={r.title}
            onClick={() => onPick(r.prompt)}
            disabled={disabled}
            className="group text-left rounded-xl bg-white border border-slate-200 hover:border-violet-300 hover:shadow-md hover:shadow-violet-500/5 p-3.5 transition-all disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl ${r.bg} flex items-center justify-center text-base shrink-0`}>
                {r.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 text-sm flex items-center gap-1">
                  {r.title}
                  <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                  এক ক্লিকে বানিয়ে দিবো
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 text-center mt-8 leading-relaxed max-w-md mx-auto">
        Forge আপনার account এ সব কিছু করতে পারে — projects, files, builds, navigation. যা বলবেন সেটাই হবে।
      </p>
    </div>
  )
}
