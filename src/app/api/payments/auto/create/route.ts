import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'
import { getPaymentGatewayConfig, gatewayCreatePayment } from '@/lib/payment-config'

/**
 * Auto payment step 1 — create a gateway checkout and return the hosted
 * payment_url. The client redirects the user there (site: same tab,
 * app: external browser). After paying, the gateway redirects the customer to
 * {origin}/payment/success?pid=<paymentId>&transactionId=...&status=...
 */

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const cfg = await getPaymentGatewayConfig()
  if (!cfg) {
    return NextResponse.json({ error: 'Auto payment is not configured yet. Use the manual bKash/Nagad/Rocket option.' }, { status: 503 })
  }

  let amount: number
  try {
    const body = await req.json()
    amount = parseInt(body.amount)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!amount || Number.isNaN(amount) || amount < 20) {
    return NextResponse.json({ error: 'Minimum add amount is ৳20' }, { status: 400 })
  }
  if (amount > 100000) {
    return NextResponse.json({ error: 'Maximum add amount is ৳100000' }, { status: 400 })
  }

  // Resolve the public origin (the gateway must reach these URLs from the browser)
  const env = (process.env.SELF_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  const origin =
    env && /^https?:\/\//.test(env) && !env.includes('localhost')
      ? env
      : (req.headers.get('origin') || req.nextUrl.origin || '').replace(/\/+$/, '')

  // Reserve the payment row first so success/cancel URLs carry a stable id
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      amount,
      method: 'amarpay',
      senderNumber: user.email.slice(0, 20),
      trxId: `AP-${Date.now().toString(36).toUpperCase()}`,
      gateway: 'amarpay',
      status: 'pending',
    },
  })

  const successUrl = `${origin}/payment/success?pid=${payment.id}`
  const cancelUrl = `${origin}/payment/cancel?pid=${payment.id}`
  // Server-to-server webhook (same pattern as the Quickpaybd WHMCS module's
  // callback URL) — the gateway calls it after checkout so the wallet is
  // credited even if the customer never returns to the site. The API key is
  // NOT passed in the URL (WHMCS does that) — it stays server-side in Setting.
  const webhookUrl = `${origin}/api/payments/callback?pid=${payment.id}`

  try {
    const r = await gatewayCreatePayment(cfg, {
      cus_name: user.name || 'ApkForge User',
      cus_email: user.email,
      amount: String(amount),
      success_url: successUrl,
      cancel_url: cancelUrl,
      webhook_url: webhookUrl,
      meta_data: { paymentId: payment.id, userId: user.id },
    })
    if (!r.ok || !r.paymentUrl) {
      await db.payment.delete({ where: { id: payment.id } }).catch(() => {})
      return NextResponse.json({ error: r.message || 'Gateway did not return a payment URL' }, { status: 502 })
    }
    await db.payment.update({ where: { id: payment.id }, data: { gatewayUrl: r.paymentUrl } })
    publish('payments', { action: 'create', id: payment.id }, user.id)
    return NextResponse.json({ paymentUrl: r.paymentUrl, paymentId: payment.id }, { status: 201 })
  } catch (e) {
    await db.payment.delete({ where: { id: payment.id } }).catch(() => {})
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'Gateway timed out. Try again.' : 'Could not reach the payment gateway. Try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
