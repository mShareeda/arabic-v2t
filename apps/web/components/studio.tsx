'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Segment } from '@arabic-v2t/core'
import type { DialectSummary } from '@/lib/dialect-summary'
import { LiveSession } from '@/lib/live-session'
import { AmplitudeMeter } from './amplitude-meter'
import { TranscriptView } from './transcript-view'
import { TranscriptActions } from './transcript-actions'

type Status = 'idle' | 'connecting' | 'recording' | 'finishing' | 'done'

const STATUS_LABEL: Record<Status, string> = {
  idle: 'جاهز',
  connecting: 'جارٍ الاتصال…',
  recording: 'يسجّل',
  finishing: 'جارٍ الإنهاء…',
  done: 'انتهى',
}

export function Studio({ dialect }: { dialect: DialectSummary }) {
  const [status, setStatus] = useState<Status>('idle')
  const [segments, setSegments] = useState<Segment[]>([])
  const [partial, setPartial] = useState('')
  const [peak, setPeak] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  const sessionRef = useRef<LiveSession | null>(null)
  const startedAtRef = useRef(0)

  // عدّاد المدة — يبيّن للمستخدم كم استهلك من حصته
  useEffect(() => {
    if (status !== 'recording') return
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250)
    return () => clearInterval(timer)
  }, [status])

  // إيقاف التسجيل عند مغادرة الصفحة — وإلا بقيت الجلسة محسوبة على المستخدم
  useEffect(() => {
    return () => {
      void sessionRef.current?.stop()
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setNotice(null)
    setSegments([])
    setPartial('')
    setStatus('connecting')

    const session = new LiveSession({
      onReady: () => {
        startedAtRef.current = Date.now()
        setStatus('recording')
      },
      onPartial: setPartial,
      onSegment: (segment) => {
        setSegments((previous) => [...previous, segment])
        // المقطع تثبّت، فالنص الجزئي الذي كان يمثّله لم يعد له معنى
        setPartial('')
      },
      onPeak: setPeak,
      onWarning: (remainingMs) => {
        setNotice(`تبقّى ${Math.round(remainingMs / 60_000)} دقيقة قبل انتهاء مدة الجلسة.`)
      },
      onDone: () => {
        setStatus('done')
        setPartial('')
        setPeak(0)
      },
      onError: (message) => {
        setError(message)
        setStatus('idle')
        setPeak(0)
      },
    })

    sessionRef.current = session
    await session.start(dialect.id, null)
  }, [dialect.id])

  const stop = useCallback(async () => {
    setStatus('finishing')
    await sessionRef.current?.stop()
  }, [])

  const editSegment = useCallback((id: string, text: string) => {
    setSegments((previous) =>
      previous.map((segment) => (segment.id === id ? { ...segment, clean: text } : segment)),
    )
  }, [])

  const isRecording = status === 'recording' || status === 'connecting'
  const minutes = Math.floor(elapsedMs / 60_000)
  const seconds = Math.floor((elapsedMs % 60_000) / 1000)

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-[var(--color-ink)] pb-5">
        <div>
          <Link href="/" className="eyebrow hover:text-[var(--color-ink)]">
            ← تغيير اللهجة
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{dialect.label}</h1>
        </div>

        <div className="flex items-center gap-3 font-mono text-sm">
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2"
            style={{
              backgroundColor:
                status === 'recording' ? 'var(--color-coral)' : 'var(--color-ink-faint)',
            }}
          />
          <span className="text-[var(--color-ink-muted)]">{STATUS_LABEL[status]}</span>
          <span className="tabular-nums text-[var(--color-ink-faint)]">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>
      </header>

      {error ? (
        <p
          role="alert"
          className="mt-5 border-s-2 border-[var(--color-coral)] bg-[var(--color-paper-raised)] px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-5 border-s-2 border-[var(--color-brass)] bg-[var(--color-paper-raised)] px-4 py-3 text-sm">
          {notice}
        </p>
      ) : null}

      {/* بلا إطار حول المؤشر — الصفحة مليئة بالخطوط الأفقية، وإطار إضافي
          يجعلها ثلاثة خطوط متجاورة بلا وظيفة */}
      <div className="my-5">
        <AmplitudeMeter peak={peak} active={status === 'recording'} />
      </div>

      <TranscriptView
        segments={segments}
        partial={partial}
        direction={dialect.direction}
        onEditSegment={editSegment}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--color-rule)] pt-6">
        {isRecording ? (
          <button
            type="button"
            onClick={() => void stop()}
            className="bg-[var(--color-coral)] px-7 py-3.5 text-[var(--color-paper)] transition-opacity hover:opacity-90"
            style={{ borderRadius: 'var(--radius-sharp)' }}
          >
            إيقاف التسجيل
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={status === 'finishing'}
            className="bg-[var(--color-ink)] px-7 py-3.5 text-[var(--color-paper)] transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ borderRadius: 'var(--radius-sharp)' }}
          >
            {segments.length > 0 ? 'تسجيل جديد' : 'ابدأ التسجيل'}
          </button>
        )}

        <TranscriptActions segments={segments} dialectLabel={dialect.label} />
      </div>
    </main>
  )
}
