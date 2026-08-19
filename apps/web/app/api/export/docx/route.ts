import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AlignmentType, Document, Packer, Paragraph, TextRun } from 'docx'
import { segmentSchema } from '@arabic-v2t/core'
import { getSessionUser } from '@/lib/auth/session'

/**
 * تصدير التفريغ كملف Word.
 *
 * يجري على الخادم لا في المتصفح: مكتبة `docx` ثقيلة، وتحميلها في حزمة العميل
 * يبطّئ أول تحميل للصفحة من أجل زر قد لا يُضغط أصلًا.
 */
const schema = z.object({
  segments: z.array(segmentSchema).min(1),
  title: z.string().trim().max(120).default('تفريغ صوتي'),
  direction: z.enum(['rtl', 'ltr']).default('rtl'),
})

export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 })
  }

  const { segments, title, direction } = parsed.data
  const isRtl = direction === 'rtl'

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            bidirectional: isRtl,
            alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 300 },
            children: [new TextRun({ text: title, bold: true, size: 32, rightToLeft: isRtl })],
          }),
          ...segments.map(
            (segment) =>
              new Paragraph({
                bidirectional: isRtl,
                alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                // فجوة الصمت التي صارت فاصل فقرة تُترجم إلى تباعد أكبر في الملف
                spacing: { after: segment.startsParagraph ? 240 : 120 },
                children: [new TextRun({ text: segment.clean, size: 24, rightToLeft: isRtl })],
              }),
          ),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(document)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // اسم الملف يُضبط في العميل؛ هنا احتياط فقط
      'content-disposition': 'attachment; filename="transcript.docx"',
    },
  })
}
