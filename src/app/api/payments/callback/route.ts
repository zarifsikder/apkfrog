import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPaymentGatewayConfig, gatewayVerifyPayment } from '@/lib/payment-config'
import { approveAutoPayment } from '@/lib/auto-payment'

/**
 * Gateway webhook — port of the Quickpaybd WHMCS module's
 * `modules/gateways/callback/Quickpaybd.php` to ApkForge.
 *
 * After checkout the gateway calls this URL with:
 *   ?pid=<paymentId>&transactionId=...&paymentMethod=...&paymentAmount=...&paymentFee=...&status=...
 *
 * Exactly like the WHMCS callback we NEVER trust these params alone — the
 * transaction is re-verified server-to-server with the gateway (API-KEY from
 * the Setting table, never from the URL) and only `status: "COMPLETED"`
 * credits the wallet. Idempotent, and the requested amount is guarded.
 *
 * Response mirrors the WHMCS module: HTTP 200 always (so the gateway does not
 * retry forever), a tiny redirect page for browsers, plain text otherwise.
 */

function pageRedirect(url: string): NextResponse {
  const safe = JSON.stringify(url)
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${url}"><script>location.href=${safe}</script></head><body style="font-family:sans-serif">Payment received — redirecting…</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

async function handle(pid: string, transactionId: string, source: string): Promise<NextResponse> {
  if (!pid) return new NextResponse('Missing pid', { status: 400 })

  const payment = await db.payment.findUnique({ where: { id: pid } })
  if (!payment || payment.gateway !== 'amarpay') return new NextResponse('Payment not found', { status: 404 })

  const origin = (process.env.SELF_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || 'https://p19yb76a1vy1-d.space-z.ai').replace(/\/+$/, '')
  const successRedirect = `${origin}/payment/success?pid=${pid}${transactionId ? `&transactionId=${encodeURIComponent(transactionId)}` : ''}&status=success`

  // Already approved — nothing to do (idempotent webhook retries land here)
  if (payment.status === 'approved') return pageRedirect(successRedirect)

  const cfg = await getPaymentGatewayConfig()
  if (!cfg) return new NextResponse('Auto payment is not configured.', { status: 503 })

  if (!transactionId) return new NextResponse('No transaction id yet — checkout not completed.', { status: 200 })

  let r
  try {
    r = await gatewayVerifyPayment(cfg, transactionId)
  } catch {
    return new NextResponse('Could not reach the payment gateway — try again shortly.', { status: 502 })
  }
  if (!r.ok) return new NextResponse('Gateway verification failed — try again shortly.', { status: 502 })

  if (!r.paid) {
    // Same spirit as the module's "Failed. Id Not Match" — but 200 so the
    // gateway stops retrying a genuinely incomplete payment.
    return new NextResponse(`Payment not completed yet${r.message ? ` (${r.message})` : ''}.`, { status: 200 })
  }

  // Amount guard — credit exactly the reserved amount, not whatever the gateway echoes
  if (r.amount != null && Math.abs(r.amount - payment.amount) > 0.99) {
    return new NextResponse(`Amount mismatch: gateway ৳${r.amount} vs requested ৳${payment.amount}. Contact support.`, { status: 200 })
  }

  const res = await approveAutoPayment(payment.id, transactionId, r.method)
  if (!res.ok) return new NextResponse(res.error, { status: 404 })

  console.log(`[payments/callback] approved via ${source}: pid=${pid} trx=${transactionId} amount=${res.amount}`)
  // Browser follow-ups (some gateways funnel the customer here) get a redirect
  return pageRedirect(successRedirect)
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  return handle(String(p.get('pid') || p.get('paymentId') || ''), String(p.get('transactionId') || p.get('transaction_id') || ''), 'GET')
}

export async function POST(req: NextRequest) {
  const p = req.nextUrl.searchParams
  let transactionId = String(p.get('transactionId') || p.get('transaction_id') || '')
  let pid = String(p.get('pid') || p.get('paymentId') || '')
  // Some gateways POST the IPN payload as form data or JSON
  try {
    const ct = req.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const body = await req.json()
      pid = pid || String(body.pid || body.paymentId || '')
      transactionId = transactionId || String(body.transactionId || body.transaction_id || '')
    } else if (ct.includes('form')) {
      const form = await req.formData()
      pid = pid || String(form.get('pid') || form.get('paymentId') || '')
      transactionId = transactionId || String(form.get('transactionId') || form.get('transaction_id') || '')
    }
  } catch {
    /* query params only — fine */
  }
  return handle(pid, transactionId, 'POST')
}
