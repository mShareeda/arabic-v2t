import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@arabic-v2t/db'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
    select: { id: true, email: true, passwordHash: true },
  })

  // رسالة واحدة للحالتين: بريد غير مسجّل وكلمة مرور خاطئة. التفريق بينهما
  // يكشف للمهاجم أي البُرد مسجّلة عندنا.
  const invalid = NextResponse.json(
    { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
    { status: 401 },
  )

  if (!user) return invalid
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) return invalid

  await createSession({ id: user.id, email: user.email })
  return NextResponse.json({ id: user.id, email: user.email })
}
