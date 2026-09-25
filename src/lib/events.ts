import { EventEmitter } from 'events'

/**
 * Global real-time event bus (Task 12).
 *
 * Every mutating API route publishes a lightweight event here; two consumers
 * react instantly:
 *  • GET /api/events  — SSE stream that pushes events to all connected
 *    browsers (the web SPA) and to the native Android app (Realtime.kt)
 *  • nothing needs polling anymore — a change made on the website appears in
 *    the app immediately and vice-versa.
 *
 * The bus lives on globalThis so it survives Next.js module reloads in dev.
 */

export interface WvEvent {
  type: string
  at: number
  by?: string // acting user id (when known)
  data?: Record<string, unknown>
}

const g = globalThis as unknown as { __wvBus?: EventEmitter }

export function bus(): EventEmitter {
  if (!g.__wvBus) {
    const em = new EventEmitter()
    em.setMaxListeners(0) // unbounded — every connected client subscribes
    g.__wvBus = em
  }
  return g.__wvBus
}

/** Publish a change event to all connected SSE clients. Never throws. */
export function publish(type: string, data?: Record<string, unknown>, by?: string) {
  try {
    const ev: WvEvent = { type, at: Date.now(), by, data }
    bus().emit('wv', `data: ${JSON.stringify(ev)}\n\n`)
  } catch {
    /* bus is best-effort */
  }
}

/** Subscribe to raw SSE-formatted event lines. Returns an unsubscribe fn. */
export function onEventLine(cb: (line: string) => void): () => void {
  const handler = (line: string) => cb(line)
  bus().on('wv', handler)
  return () => bus().off('wv', handler)
}
