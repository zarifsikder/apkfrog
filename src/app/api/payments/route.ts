import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser, unauthorized } from '@/lib/auth'
import { publish } from '@/lib/events'

export async function GET(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const payments = await db.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ payments })
}

export async function POST(req: NextRequest) {
  const user = await getUser(req)
  if (!user) return unauthorized()
  const { amount, method, senderNumber, trxId } = await req.json()
  const amt = parseInt(amount)
  if (!amt || amt < 20) return NextResponse.json({ error: 'Minimum add amount is ৳20' }, { status: 400 })
  if (!['bkash', 'nagad', 'rocket'].includes(method)) return NextResponse.json({ error: 'Select a payment method' }, { status: 400 })
  if (!senderNumber || String(senderNumber).length < 10) return NextResponse.json({ error: 'Enter a valid sender number' }, { status: 400 })
  if (!trxId || String(trxId).length < 4) return NextResponse.json({ error: 'Enter a valid Transaction ID' }, { status: 400 })

  const payment = await db.payment.create({
    data: {
      userId: user.id,
      amount: amt,
      method,
      senderNumber: String(senderNumber).slice(0, 20),
      trxId: String(trxId).slice(0, 40),
    },
  })
  await db.notification.create({
    data: {
      userId: user.id,
      title: 'Payment request submitted ⏳',
      body: `Your ৳${amt} ${method.toUpperCase()} add-money request (TrxID: ${trxId}) is pending review. It usually takes a few minutes.`,
    },
  })
  publish('payments', { action: 'create', id: payment.id }, user.id)
  publish('notifications', { action: 'new' }, user.id)
  return NextResponse.json({ payment }, { status: 201 })
}
