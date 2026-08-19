import { NextResponse } from 'next/server'
import { getSessionUser, mintGatewayTicket } from '@/lib/auth/session'

/** يصدر تذكرة قصيرة العمر يستخدمها المتصفح لفتح جلسة تفريغ مع الـ gateway. */
export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  }

  return NextResponse.json({ ticket: await mintGatewayTicket(user) })
}
