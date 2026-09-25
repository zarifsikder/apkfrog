'use client'

import { useEffect, useRef } from 'react'

/**
 * Real-time client (Task 12) — one shared EventSource to /api/events.
 *
 * The connection is opened once per browser tab (module-level singleton) the
 * first time any view subscribes. Events published by the server (from the
 * website OR the native Android app) reach every client within milliseconds:
 *
 *   App-এ update → event → site re-fetches instantly
 *   Site-এ update → event → other tabs + the native app update instantly
 *
 * Views use the useWvEvent hook:  useWvEvent(['projects', 'builds'], (type) => refetch())
 */

export type WvClientEvent = { type: string; at: number; by?: string; data?: Record<string, unknown> }

type Listener = (ev: WvClientEvent) => void

const g = globalThis as unknown as {
  __wvEs?: EventSource
  __wvListeners?: Set<Listener>
}

function listeners(): Set<Listener> {
  if (!g.__wvListeners) g.__wvListeners = new Set()
  return g.__wvListeners
}

function ensureConnection() {
  if (typeof window === 'undefined') return
  if (g.__wvEs && g.__wvEs.readyState !== EventSource.CLOSED) return
  const es = new EventSource('/api/events')
  g.__wvEs = es
  es.onmessage = (e) => {
    try {
      const ev = JSON.parse(e.data) as WvClientEvent
      if (!ev?.type || ev.type === 'connected') return
      for (const fn of listeners()) {
        try {
          fn(ev)
        } catch {
          /* a broken listener must not kill the bus */
        }
      }
    } catch {
      /* malformed frame */
    }
  }
  // EventSource auto-reconnects; nothing else needed here
}

/** Close the shared connection (used on logout). */
export function closeRealtime() {
  try {
    g.__wvEs?.close()
  } catch {
    /* ignore */
  }
  g.__wvEs = undefined
}

/**
 * Subscribe to server events. Re-runs `handler` whenever an event whose type
 * is in `types` (or ANY event when types is omitted) arrives.
 */
export function useWvEvent(types: string[] | null, handler: (ev: WvClientEvent) => void) {
  const ref = useRef(handler)
  const key = types ? types.join('|') : '*'
  useEffect(() => {
    ref.current = handler
    ensureConnection()
    const set = types && types.length ? new Set(types) : null
    const fn: Listener = (ev) => {
      if (!set || set.has(ev.type)) ref.current(ev)
    }
    listeners().add(fn)
    return () => {
      listeners().delete(fn)
    }
  }, [key])
}
