import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { onEventLine } from '@/lib/events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Server-Sent Events stream — the real-time backbone (Task 12).
 *
 * Browsers connect with EventSource('/api/events'); the native Android app
 * connects with a raw HttpURLConnection reading the same stream. Any change
 * made anywhere (website or app) is published to this stream, so every
 * client re-fetches the affected data within milliseconds.
 *
 * Event payloads: data: {"type":"projects|builds|files|wallet|payments|
 *                                notifications|app|engine|templates|user",
 *                          "at":<ms>,"by":"<userId>","data":{...}}
 */
export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()
  let unsub: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const send = (text: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          closed = true
        }
      }

      // immediate hello + client hint to reconnect quickly if dropped
      send('retry: 3000\n\n')
      send(`data: ${JSON.stringify({ type: 'connected', at: Date.now(), by: user.id })}\n\n`)

      unsub = onEventLine((line) => send(line))

      // comment heartbeat keeps proxies (Caddy) and clients alive
      heartbeat = setInterval(() => send(': ping\n\n'), 25000)

      req.signal.addEventListener('abort', () => {
        closed = true
        unsub?.()
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
    cancel() {
      closed = true
      unsub?.()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
