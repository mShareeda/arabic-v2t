import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@arabic-v2t/db'
import { findDialect } from '@arabic-v2t/core'
import { getSessionUser } from '@/lib/auth/session'

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default async function LibraryPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const transcripts = await prisma.transcript.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      dialectId: true,
      durationMs: true,
      source: true,
      createdAt: true,
    },
  })

  return (
    <main className="mx-auto min-h-dvh max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[var(--color-ink)] pb-5">
        <div>
          <Link href="/" className="eyebrow hover:text-[var(--color-ink)]">
            ← تسجيل جديد
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">سجل التفريغات</h1>
        </div>
        <span className="meta text-sm text-[var(--color-ink-faint)]">
          {transcripts.length} تفريغ
        </span>
      </header>

      {transcripts.length === 0 ? (
        <p className="mt-10 text-[var(--color-ink-muted)]">
          لا توجد تفريغات بعد.{' '}
          <Link href="/" className="text-[var(--color-brass)] underline">
            ابدأ تسجيلك الأول
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-2">
          {transcripts.map((transcript, index) => {
            const dialect = findDialect(transcript.dialectId)

            return (
              <li key={transcript.id} className="border-b border-[var(--color-rule)]">
                <Link
                  href={`/library/${transcript.id}`}
                  className="flex flex-wrap items-baseline gap-x-5 gap-y-2 py-5 transition-colors hover:bg-[var(--color-paper-raised)]"
                >
                  <span className="section-index w-8 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span className="min-w-0 flex-1 truncate text-lg">{transcript.title}</span>

                  <span className="text-xs text-[var(--color-ink-faint)]">
                    {dialect?.label ?? transcript.dialectId}
                  </span>
                  <span className="meta text-xs text-[var(--color-ink-faint)]">
                    {formatDuration(transcript.durationMs)}
                  </span>
                  <span className="text-xs text-[var(--color-ink-faint)]">
                    {transcript.source === 'LIVE' ? 'حي' : 'ملف'}
                  </span>
                  <time
                    dateTime={transcript.createdAt.toISOString()}
                    className="meta text-xs text-[var(--color-ink-faint)]"
                  >
                    {transcript.createdAt.toISOString().slice(0, 10)}
                  </time>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
