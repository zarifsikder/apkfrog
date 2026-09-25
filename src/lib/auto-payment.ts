import { db } from '@/lib/db'
import { publish } from '@/lib/events'

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
 */
export async function approveAutoPayment(
  paymentId: string,
  trxId: string,
  method?: string,
): Promise<
  | { ok: false; error: string }
  | { ok: true; alreadyDone: boolean; wallet: number; amount: number; userId: string }
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

  return { ok: true, alreadyDone: false, wallet: updatedUser.wallet, amount: updatedPayment.amount, userId: payment.userId }
}
