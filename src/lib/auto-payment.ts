import { db } from '@/lib/db'
import { publish } from '@/lib/events'
import { autoActivateFromPayment } from './subscription'

/**
 * Shared auto-payment approval — the "addInvoicePayment" step of the
 * Quickpaybd/AmarPay WHMCS gateway module, ported to ApkForge.
 *
 * Used by BOTH:
 *  • /api/payments/auto/verify (user-session verify from the success page /
 *    Wallet "Check status" / Android app)
 *  • /api/payments/callback    (gateway webhook — no user session)
 *
 * Idempotent: an already-approved payment never double-credits the wallet.
 *
 * If the payment row has a `pendingPlanId` (subscription purchase), the plan
 * is auto-activated right after the wallet is credited — the price is debited
 * back from the wallet and the user's plan is set.
 */
export async function approveAutoPayment(
  paymentId: string,
  trxId: string,
  method?: string,
): Promise<
  | { ok: false; error: string }
  | { ok: true; alreadyDone: boolean; wallet: number; amount: number; userId: string; planActivated?: boolean }
> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } })
  if (!payment) return { ok: false, error: 'Payment not found' }

  if (payment.status === 'approved') {
    const user = await db.user.findUnique({ where: { id: payment.userId } })
    return { ok: true, alreadyDone: true, wallet: user?.wallet ?? 0, amount: payment.amount, userId: payment.userId }
  }

  const [updatedPayment, updatedUser] = await db.$transaction([
    db.payment.update({
      where: { id: payment.id },
      data: {
        status: 'approved',
        trxId,
        method: method ? method.toLowerCase().slice(0, 12) : payment.method || 'amarpay',
        verifiedAt: new Date(),
      },
    }),
    db.user.update({ where: { id: payment.userId }, data: { wallet: { increment: payment.amount } } }),
  ])

  await db.notification.create({
    data: {
      userId: payment.userId,
      title: 'Payment verified automatically ✅',
      body: `Your ৳${payment.amount} auto payment (TrxID: ${trxId}) is approved and ৳${payment.amount} has been added to your wallet.`,
    },
  })

  publish('payments', { action: 'approved', id: payment.id }, payment.userId)
  publish('wallet', { action: 'credited', amount: payment.amount }, payment.userId)
  publish('notifications', { action: 'new' }, payment.userId)

  // Auto-activate subscription if this payment was tagged with a plan
  let planActivated = false
  if (payment.pendingPlanId) {
    const activation = await autoActivateFromPayment(paymentId)
    if (activation?.ok) planActivated = true
  }

  // Re-read the wallet after possible plan debit so the returned value is accurate
  const finalUser = planActivated ? await db.user.findUnique({ where: { id: payment.userId } }) : updatedUser

  return {
    ok: true,
    alreadyDone: false,
    wallet: finalUser?.wallet ?? updatedUser.wallet,
    amount: updatedPayment.amount,
    userId: payment.userId,
    planActivated,
  }
}
