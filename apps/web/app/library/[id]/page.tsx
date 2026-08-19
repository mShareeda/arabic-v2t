import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@arabic-v2t/db'
import { findDialect, segmentSchema } from '@arabic-v2t/core'
import { z } from 'zod'
import { getSessionUser } from '@/lib/auth/session'
import { TranscriptDetail } from '@/components/transcript-detail'

export default async function TranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const { id } = await params

  // شرط `userId` داخل الاستعلام: لا يمكن فتح تفريغ مستخدم آخر بمعرفة مُعرّفه
  const transcript = await prisma.transcript.findFirst({
    where: { id, userId: user.id },
  })

  if (!transcript) notFound()

  const dialect = findDialect(transcript.dialectId)

  // المقاطع مخزّنة كـ Json، فنتحقق من شكلها بدل الوثوق بما في قاعدة البيانات
  const segments = z.array(segmentSchema).safeParse(transcript.segments)

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="border-b border-[var(--color-ink)] pb-5">
        <Link href="/library" className="eyebrow hover:text-[var(--color-ink)]">
          ← سجل التفريغات
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{transcript.title}</h1>
        <p className="mt-2 font-mono text-xs text-[var(--color-ink-faint)]">
          {dialect?.label ?? transcript.dialectId} · {Math.round(transcript.durationMs / 1000)}{' '}
          ثانية · {transcript.createdAt.toISOString().slice(0, 10)}
        </p>
      </header>

      <TranscriptDetail
        id={transcript.id}
        segments={segments.success ? segments.data : []}
        fallbackText={transcript.cleanText}
        direction={dialect?.direction ?? 'rtl'}
        dialectLabel={dialect?.label ?? transcript.dialectId}
      />
    </main>
  )
}
