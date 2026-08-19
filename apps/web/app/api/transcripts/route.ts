import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@arabic-v2t/db'
import { findDialect, renderSegments, segmentSchema } from '@arabic-v2t/core'
import { getSessionUser } from '@/lib/auth/session'

const createSchema = z.object({
  dialectId: z.string(),
  durationMs: z.number().int().nonnegative(),
  source: z.enum(['LIVE', 'UPLOAD']),
  segments: z.array(segmentSchema).min(1),
  title: z.string().trim().max(120).optional(),
})

/** يشتق عنوانًا من أول جملة، فلا يضطر المستخدم لتسمية كل تفريغ. */
function deriveTitle(text: string, dialectLabel: string): string {
  const firstLine = text.split('\n')[0]?.trim() ?? ''
  if (firstLine.length === 0) return `تفريغ ${dialectLabel}`
  return firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine
}

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })

  const transcripts = await prisma.transcript.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    // نستثني `segments` و`rawText`: القائمة لا تعرضهما، وحملهما لكل سجل
    // يضخّم الاستجابة بلا فائدة
    select: {
      id: true,
      dialectId: true,
      title: true,
      durationMs: true,
      source: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ transcripts })
}

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })

  const parsed = createSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'بيانات التفريغ غير صالحة' }, { status: 400 })
  }

  const dialect = findDialect(parsed.data.dialectId)
  if (!dialect) {
    return NextResponse.json({ error: 'لهجة غير معروفة' }, { status: 400 })
  }

  const cleanText = renderSegments(parsed.data.segments)

  const transcript = await prisma.transcript.create({
    data: {
      userId: user.id,
      dialectId: dialect.id,
      title: parsed.data.title ?? deriveTitle(cleanText, dialect.label),
      durationMs: parsed.data.durationMs,
      source: parsed.data.source,
      rawText: parsed.data.segments.map((segment) => segment.raw).join(' '),
      cleanText,
      segments: parsed.data.segments,
    },
    select: { id: true },
  })

  return NextResponse.json({ id: transcript.id }, { status: 201 })
}
