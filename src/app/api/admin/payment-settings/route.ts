import { NextRequest, NextResponse } from 'next/server'
import { getUser, unauthorized, isAdminEmail } from '@/lib/auth'
import { getPaymentGatewayStatus, savePaymentGatewaySettings, DEFAULT_GATEWAY_URL } from '@/lib/payment-config'

/**
 * Admin Panel → Pay tab — gateway URL + API-KEY (AmarPay auto payment).
 * GET returns the masked API key; PUT saves (empty key = keep current).
 * Accepts legacy `brandKey` field name for compatibility.
 */

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const status = await getPaymentGatewayStatus()
  return NextResponse.json(status)
}

export async function PUT(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  try {
    const body = await req.json()
    await savePaymentGatewaySettings({
      baseUrl: body.baseUrl !== undefined ? String(body.baseUrl) : undefined,
      apiKey: body.apiKey !== undefined ? String(body.apiKey) : body.brandKey !== undefined ? String(body.brandKey) : undefined,
    })
    const status = await getPaymentGatewayStatus()
    return NextResponse.json({ ...status, defaultUrl: DEFAULT_GATEWAY_URL })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid settings payload'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
