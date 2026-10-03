import { db } from '@/lib/db'

/**
 * AmarPay auto-payment gateway settings — stored in the Setting table,
 * editable from the Admin Panel → Pay tab.
 *
 * Auth model (verified against the LIVE gateway): the single API-KEY header is
 * all the gateway needs — BRAND-KEY/SECRET-KEY are optional and unused here.
 *
 * Docs (https://amarpayment.site/developers/docs):
 *   Base URL   https://pay.amarpayment.site/
 *   Header     Content-Type / API-KEY
 *   Create     POST {base}/api/payment/create  → { status: 1, message, payment_url }
 *   Verify     POST {base}/api/payment/verify  { transaction_id }
 *              → { status: "COMPLETED"|"PENDING"|"ERROR", amount, payment_method, ... }
 *   Success redirect carries ?transactionId=&paymentMethod=&paymentAmount=&paymentFee=&status=
 */

const K_URL = 'pay_gateway_url'
const K_KEY = 'pay_api_key'

export const DEFAULT_GATEWAY_URL = 'https://pay.amarpayment.site'

export interface PaymentGatewayConfig {
  baseUrl: string // no trailing slash
  apiKey: string
}

async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } }).catch(() => null)
  return row?.value ?? null
}

async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } })
}

function cleanUrl(v: string): string {
  return v.replace(/\/+$/, '')
}

export async function getPaymentGatewayConfig(): Promise<PaymentGatewayConfig | null> {
  const [url, apiKey] = await Promise.all([getSetting(K_URL), getSetting(K_KEY)])
  const base = cleanUrl(url || DEFAULT_GATEWAY_URL)
  if (!apiKey) return null
  return { baseUrl: base, apiKey }
}

export async function getPaymentGatewayStatus() {
  const [url, apiKey] = await Promise.all([getSetting(K_URL), getSetting(K_KEY)])
  return {
    configured: !!apiKey,
    baseUrl: cleanUrl(url || DEFAULT_GATEWAY_URL),
    apiKeyMasked: maskKey(apiKey || ''),
  }
}

export async function savePaymentGatewaySettings(input: {
  baseUrl?: string
  apiKey?: string
}): Promise<void> {
  if (input.baseUrl !== undefined) {
    const u = cleanUrl(input.baseUrl.trim())
    if (u && !/^https?:\/\//.test(u)) throw new Error('Gateway URL must start with http(s)://')
    await setSetting(K_URL, u || DEFAULT_GATEWAY_URL)
  }
  if (input.apiKey !== undefined && input.apiKey.trim()) await setSetting(K_KEY, input.apiKey.trim())
}

/** Gateway headers — Content-Type + API-KEY (verified against the live gateway). */
export function gatewayHeaders(cfg: PaymentGatewayConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'API-KEY': cfg.apiKey,
  }
}

/**
 * Create a gateway payment. Returns the hosted payment_url on success.
 * Response (docs): { status: true, message, payment_url } / { status: false, message }
 */
export async function gatewayCreatePayment(
  cfg: PaymentGatewayConfig,
  body: { cus_name: string; cus_email: string; amount: string; success_url: string; cancel_url: string; meta_data?: object },
): Promise<{ ok: boolean; paymentUrl?: string; message: string }> {
  const res = await fetch(`${cfg.baseUrl}/api/payment/create`, {
    method: 'POST',
    headers: gatewayHeaders(cfg),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  })
  const data = await res.json().catch(() => ({}))
  // Live gateway returns status: 1 on success (docs say true) and 0/false on error
  const okStatus = data.status === 1 || data.status === '1' || data.status === true || data.status === 'true'
  if (res.ok && okStatus && data.payment_url) {
    return { ok: true, paymentUrl: String(data.payment_url), message: String(data.message || 'Payment URL created') }
  }
  return { ok: false, message: String(data.message || `Gateway error (HTTP ${res.status})`) }
}

/**
 * Verify a transaction. Response shape is gateway-specific; we accept the common
 * fields (status / transaction status / amount) and treat success strictly.
 */
export async function gatewayVerifyPayment(
  cfg: PaymentGatewayConfig,
  transactionId: string,
): Promise<{ ok: boolean; paid: boolean; amount?: number; method?: string; message: string; raw?: unknown }> {
  const res = await fetch(`${cfg.baseUrl}/api/payment/verify`, {
    method: 'POST',
    headers: gatewayHeaders(cfg),
    body: JSON.stringify({ transaction_id: transactionId }),
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  })
  const raw = await res.json().catch(() => null)
  if (!res.ok) return { ok: false, paid: false, message: `Gateway verify failed (HTTP ${res.status})`, raw }
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  // Docs: status is "COMPLETED" | "PENDING" | "ERROR" (string); error replies use false/0
  const status = String(data.status ?? data.payment_status ?? data.transaction_status ?? '').toLowerCase()
  const paid = status === 'completed' || status === 'success' || status === 'true' || status === '1' || status === '1.0'
  const amount = data.amount != null ? parseFloat(String(data.amount)) : data.paymentAmount != null ? parseFloat(String(data.paymentAmount)) : undefined
  const method = data.payment_method != null ? String(data.payment_method) : data.paymentMethod != null ? String(data.paymentMethod) : undefined
  return { ok: true, paid, amount: Number.isFinite(amount) ? amount : undefined, method, message: String(data.message || ''), raw }
}

export function maskKey(k: string): string | null {
  if (!k) return null
  if (k.length <= 8) return '••••'
  return `${k.slice(0, 4)}••••••••${k.slice(-4)}`
}
