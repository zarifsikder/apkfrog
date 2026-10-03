import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { getPaymentGatewayConfig, gatewayVerifyPayment } from '@/lib/payment-config'
import { approveAutoPayment } from '@/lib/auto-payment'

/**
 * Auto payment step 2 — verify a transaction with the gateway and, on success,
 * credit the wallet. Idempotent: an already-approved payment never double-credits.
 *
 * Called from:
 *  • /payment/success page (gateway redirect carried transactionId + pid)
 *  • the Wallet page / Android app "Check status" (pid only — transactionId is
 *    read back from the stored payment row after the user returns from checkout)
 */

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()

  const cfg = await getPaymentGatewayConfig()
  if (!cfg) return NextResponse.json({ error: 'Auto payment is not configured yet.' }, { status: 503 })

  let paymentId = ''
  let transactionId = ''
  try {
    const body = await req.json()
    paymentId = String(body.paymentId || body.pid || '')
    transactionId = String(body.transactionId || body.transaction_id || '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!paymentId && !transactionId) {
    return NextResponse.json({ error: 'paymentId or transactionId is required' }, { status: 400 })
  }

  const payment = paymentId
    ? await db.payment.findUnique({ where: { id: paymentId } })
    : await db.payment.findFirst({ where: { userId: user.id, gateway: 'amarpay', trxId: transactionId }, orderBy: { createdAt: 'desc' } })
  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.userId !== user.id) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  if (payment.status === 'approved') {
    return NextResponse.json({ status: 'approved', amount: payment.amount, wallet: user.wallet, trxId: payment.trxId, alreadyDone: true })
  }

  // Resolve the transaction id: explicit param > stored trxId (AP- prefixed ones
  // are internal references, so only stored real gateway ids qualify)
  const trx = transactionId || (!payment.trxId.startsWith('AP-') ? payment.trxId : '')
  if (!trx) {
    return NextResponse.json({ status: 'pending', message: 'No transaction to verify yet — complete the checkout first.' })
  }

  let r
  try {
    r = await gatewayVerifyPayment(cfg, trx)
  } catch {
    return NextResponse.json({ error: 'Could not reach the payment gateway. Try again.' }, { status: 502 })
  }
  if (!r.ok) return NextResponse.json({ error: r.message }, { status: 502 })

  if (!r.paid) {
    const msg = r.message || 'Payment is not completed yet.'
    return NextResponse.json({ status: payment.status, message: msg })
  }

  // Amount guard — credit exactly the reserved amount, not whatever the gateway echoes
  if (r.amount != null && Math.abs(r.amount - payment.amount) > 0.99) {
    return NextResponse.json({ error: `Gateway amount (৳${r.amount}) does not match the requested ৳${payment.amount}. Contact support.` }, { status: 409 })
  }

  const res = await approveAutoPayment(payment.id, trx, r.method)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 })

  return NextResponse.json({ status: 'approved', amount: payment.amount, wallet: res.wallet, trxId: trx })
}
