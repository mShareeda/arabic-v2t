import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@arabic-v2t/db'
import { hashPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'

const schema = z.object({
  email: z.string().email('صيغة البريد الإلكتروني غير صحيحة'),
  password: z.string().min(8, 'كلمة المرور يجب ألا تقل عن 8 محارف'),
  name: z.string().trim().min(1).max(80).optional(),
})

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'بيانات غير صالحة' },
      { status: 400 },
    )
  }

  const email = parsed.data.email.toLowerCase().trim()

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return NextResponse.json({ error: 'هذا البريد مسجّل مسبقًا' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(parsed.data.password),
      name: parsed.data.name ?? null,
    },
    select: { id: true, email: true },
  })

  await createSession(user)
  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
