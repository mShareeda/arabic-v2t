import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@arabic-v2t/db'
import { renderSegments, segmentSchema } from '@arabic-v2t/core'
import { getSessionUser } from '@/lib/auth/session'

const updateSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  segments: z.array(segmentSchema).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params

  // شرط `userId` جزء من الاستعلام لا فحص لاحق: بهذا لا يمكن قراءة تفريغ
  // مستخدم آخر حتى بمعرفة مُعرّفه
  const transcript = await prisma.transcript.findFirst({
    where: { id, userId: user.id },
  })

  if (!transcript) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  return NextResponse.json({ transcript })
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  const parsed = updateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 })
  }

  const existing = await prisma.transcript.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  })
  if (!existing) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })

  await prisma.transcript.update({
    where: { id },
    data: {
      ...(parsed.data.title ? { title: parsed.data.title } : {}),
      ...(parsed.data.segments
        ? {
            segments: parsed.data.segments,
            cleanText: renderSegments(parsed.data.segments),
          }
        : {}),
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const { id } = await params
  const result = await prisma.transcript.deleteMany({ where: { id, userId: user.id } })

  if (result.count === 0) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
