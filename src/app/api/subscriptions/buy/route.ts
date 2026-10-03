import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'
import { getPaymentGatewayConfig, gatewayCreatePayment } from '@/lib/payment-config'
import { activatePlan } from '@/lib/subscription'

/**
 * POST /api/subscriptions/buy
 * Body: { planId, cycle: 'monthly' | 'yearly' }
 *
 * Unified subscription purchase flow:
 *   1. Look up the plan + price.
 *   2. If the user's wallet balance >= price → debit wallet + activate plan
 *      immediately. No gateway involved. Done.
 *   3. Otherwise → create a gateway checkout for the shortfall. The payment
 *      row is tagged with `pendingPlanId` so /api/payments/auto/verify and
 *      /api/payments/callback can auto-activate the plan once the gateway
 *      confirms success.
 *
 * Returns:
 *   { ok: true, source: 'wallet', plan: {...} }
 *      — wallet payment succeeded, plan is now active
 *   { ok: true, source: 'gateway', paymentUrl, paymentId, shortfall }
 *      — redirect the user to paymentUrl
 *   { error: '...' } with 4xx/5xx — anything went wrong
 */
export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  let planId = ''
  let cycle: 'monthly' | 'yearly' = 'monthly'
  try {
    const body = await req.json()
    planId = String(body.planId || '')
    cycle = body.cycle === 'yearly' ? 'yearly' : 'monthly'
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!planId) return NextResponse.json({ error: 'planId is required' }, { status: 400 })

  const plan = await db.plan.findUnique({ where: { id: planId } })
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
  if (!plan.isActive) return NextResponse.json({ error: 'This plan is not available right now' }, { status: 400 })
  if (plan.name.toLowerCase() === 'free') return NextResponse.json({ error: 'The Free plan cannot be purchased' }, { status: 400 })

  const price = cycle === 'yearly' && plan.priceYearly > 0 ? plan.priceYearly : plan.price
  if (price <= 0) return NextResponse.json({ error: 'This plan is free — no purchase needed' }, { status: 400 })

  if (user.plan === plan.name) {
    return NextResponse.json({ error: `You are already on the ${plan.name} plan` }, { status: 400 })
  }

  // ---------- 1. WALLET FIRST ----------
  if (user.wallet >= price) {
    const result = await activatePlan({
      userId: user.id,
      planId: plan.id,
      planName: plan.name,
      price,
      cycle,
      source: 'wallet',
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    publish('wallet', { action: 'debited', amount: price }, user.id)
    publish('user', { action: 'plan', plan: plan.name }, user.id)
    publish('notifications', { action: 'new' }, user.id)

    return NextResponse.json({
      ok: true,
      source: 'wallet',
      plan: { id: plan.id, name: plan.name, cycle },
      wallet: result.wallet,
    })
  }

  // ---------- 2. FALLBACK TO GATEWAY ----------
  const cfg = await getPaymentGatewayConfig()
  if (!cfg) {
    return NextResponse.json(
      {
        error: `Your wallet has ৳${user.wallet} but the plan costs ৳${price}. Add at least ৳${price - user.wallet} to your wallet first — auto payment is not configured yet.`,
        wallet: user.wallet,
        price,
        shortfall: price - user.wallet,
      },
      { status: 402 },
    )
  }

  // Resolve origin for success/cancel/webhook URLs
  const env = (process.env.SELF_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
  const origin =
    env && /^https?:\/\//.test(env) && !env.includes('localhost')
      ? env
      : (req.headers.get('origin') || req.nextUrl.origin || '').replace(/\/+$/, '')

  // Create a payment row tagged with the pending plan — on gateway success,
  // the verify/callback routes will both credit the wallet (full amount) AND
  // auto-activate the plan from the same row.
  const payment = await db.payment.create({
    data: {
      userId: user.id,
      amount: price,
      method: 'amarpay',
      senderNumber: user.email.slice(0, 20),
      trxId: `AP-${Date.now().toString(36).toUpperCase()}`,
      gateway: 'amarpay',
      status: 'pending',
      pendingPlanId: plan.id,
    },
  })

  const successUrl = `${origin}/payment/success?pid=${payment.id}`
  const cancelUrl = `${origin}/payment/cancel?pid=${payment.id}`
  const webhookUrl = `${origin}/api/payments/callback?pid=${payment.id}`

  try {
    const r = await gatewayCreatePayment(cfg, {
      cus_name: user.name || 'ApkForge User',
      cus_email: user.email,
      amount: String(price),
      success_url: successUrl,
      cancel_url: cancelUrl,
      webhook_url: webhookUrl,
      meta_data: { paymentId: payment.id, userId: user.id, planId: plan.id, cycle },
    })
    if (!r.ok || !r.paymentUrl) {
      await db.payment.delete({ where: { id: payment.id } }).catch(() => {})
      return NextResponse.json({ error: r.message || 'Gateway did not return a payment URL' }, { status: 502 })
    }
    await db.payment.update({ where: { id: payment.id }, data: { gatewayUrl: r.paymentUrl } })
    publish('payments', { action: 'create', id: payment.id }, user.id)

    return NextResponse.json({
      ok: true,
      source: 'gateway',
      paymentUrl: r.paymentUrl,
      paymentId: payment.id,
      price,
      wallet: user.wallet,
      shortfall: price - user.wallet,
      plan: { id: plan.id, name: plan.name, cycle },
    })
  } catch (e) {
    await db.payment.delete({ where: { id: payment.id } }).catch(() => {})
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'Gateway timed out. Try again.' : 'Could not reach the payment gateway. Try again.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
