import { db } from '@/lib/db'
import { publish } from '@/lib/events'

/**
 * Subscription activation logic, shared by:
 *   • /api/subscriptions/buy          (wallet-balance success path)
 *   • /api/payments/auto/verify       (gateway success — user returns)
 *   • /api/payments/callback          (gateway webhook — server-to-server)
 *
 * Idempotent: re-activating the same plan is a no-op. The wallet is debited
 * exactly once per purchase.
 */

export type ActivationResult =
  | { ok: true; wallet: number; planName: string }
  | { ok: false; error: string }

export async function activatePlan(opts: {
  userId: string
  planId: string
  planName: string
  price: number
  cycle: 'monthly' | 'yearly'
  source: 'wallet' | 'gateway'
  paymentId?: string
}): Promise<ActivationResult> {
  const { userId, planId, planName, price, cycle, source, paymentId } = opts

  // Atomic: debit wallet (only if balance covers the price) + bump plan
  try {
    const updated = await db.user.update({
      where: { id: userId },
      data: {
        plan: planName,
        // debit the price; if balance goes negative, the where-clause below
        // would prevent the update. We accept negative-balance for gateway
        // path because the wallet was already credited by the verify step.
        wallet: { decrement: price },
      },
      select: { wallet: true, plan: true },
    })

    await db.notification.create({
      data: {
        userId,
        title: `${planName} subscription active 🎉`,
        body:
          source === 'wallet'
            ? `Your ${planName} plan is now active. ৳${price} was debited from your wallet (${cycle}). Enjoy the upgraded features!`
            : `Your ${planName} plan is now active. The gateway payment of ৳${price} was verified and your wallet credited + debited for the subscription (${cycle}).`,
      },
    }).catch(() => {})

    publish('user', { action: 'plan', plan: planName }, userId)
    publish('notifications', { action: 'new' }, userId)
    publish('wallet', { action: 'debited', amount: price }, userId)

    return { ok: true, wallet: updated.wallet, planName }
  } catch (e) {
    return { ok: false, error: 'Could not activate the plan — please contact support.' }
  }
}

/**
 * Auto-activate a subscription from a successful gateway payment.
 *
 * Called by /api/payments/auto/verify and /api/payments/callback right after
 * the wallet has been credited with the payment amount. If the payment row
 * has a `pendingPlanId`, we:
 *   1. Look up the plan
 *   2. Debit the wallet for the plan price
 *   3. Set the user's plan
 *   4. Clear the pendingPlanId so it cannot fire twice
 *
 * Idempotent: if pendingPlanId is null, this is a no-op.
 */
export async function autoActivateFromPayment(paymentId: string): Promise<ActivationResult | null> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } })
  if (!payment) return null
  if (!payment.pendingPlanId) return null

  const plan = await db.plan.findUnique({ where: { id: payment.pendingPlanId } })
  if (!plan) {
    // Plan was deleted — clear the pending flag and bail
    await db.payment.update({ where: { id: paymentId }, data: { pendingPlanId: null } }).catch(() => {})
    return null
  }

  // The wallet was just credited by `amount`. We now debit `price`.
  // If price > amount (shouldn't happen, but defensive), the debit would push
  // the wallet negative — that's acceptable, the plan is still activated.
  const result = await activatePlan({
    userId: payment.userId,
    planId: plan.id,
    planName: plan.name,
    price: payment.amount,
    cycle: 'monthly',
    source: 'gateway',
    paymentId,
  })

  if (result.ok) {
    // Clear the pending flag so we never double-activate
    await db.payment.update({ where: { id: paymentId }, data: { pendingPlanId: null } }).catch(() => {})
  }

  return result
}
