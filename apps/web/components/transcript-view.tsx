'use client'

import { useMemo, useState } from 'react'
import type { Segment } from '@arabic-v2t/core'

interface TranscriptViewProps {
  segments: readonly Segment[]
  /** النص الجزئي غير المستقر، يظهر أسفل المقاطع المثبّتة. */
  partial: string
  direction: 'rtl' | 'ltr'
  /** يُستدعى عند تعديل المستخدم لنص مقطع يدويًا. */
  onEditSegment: (id: string, text: string) => void
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function TranscriptView({
  segments,
  partial,
  direction,
  onEditSegment,
}: TranscriptViewProps) {
  const [showRaw, setShowRaw] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const removedCount = useMemo(
    () => segments.reduce((total, segment) => total + segment.removed.length, 0),
    [segments],
  )

  const isEmpty = segments.length === 0 && partial.trim().length === 0

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-rule)] pb-3">
        <div className="flex items-baseline gap-3">
          <span className="eyebrow">النص</span>
          {removedCount > 0 ? (
            <span className="text-xs text-[var(--color-ink-faint)]">
              حذفت {removedCount} كلمة حشو
            </span>
          ) : null}
        </div>

        {/* التبديل بين الخام والنظيف — النص الأصلي لا يُتلف أبدًا */}
        {segments.length > 0 ? (
          <div className="flex border border-[var(--color-rule)] text-xs">
            <button
              type="button"
              onClick={() => setShowRaw(false)}
              className={`px-3 py-1.5 transition-colors ${
                !showRaw
                  ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-raised)]'
              }`}
            >
              منقح
            </button>
            <button
              type="button"
              onClick={() => setShowRaw(true)}
              className={`border-s border-[var(--color-rule)] px-3 py-1.5 transition-colors ${
                showRaw
                  ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                  : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-raised)]'
              }`}
            >
              خام
            </button>
          </div>
        ) : null}
      </header>

      <div
        dir={direction}
        className="flex-1 overflow-y-auto py-6 text-lg leading-[2] sm:text-xl sm:leading-[2.1]"
      >
        {isEmpty ? (
          <p className="text-[var(--color-ink-faint)]">سيظهر النص هنا فور أن تبدأ بالكلام.</p>
        ) : null}

        {segments.map((segment) => (
          <div
            key={segment.id}
            className={`segment-enter group relative ${segment.startsParagraph ? 'mt-7' : 'mt-1'}`}
          >
            <span
              className="section-index absolute -top-5 select-none opacity-0 transition-opacity group-hover:opacity-100"
              style={{ insetInlineStart: 0 }}
            >
              {formatTimestamp(segment.startMs)}
            </span>

            {editingId === segment.id ? (
              <textarea
                autoFocus
                defaultValue={segment.clean}
                onBlur={(event) => {
                  onEditSegment(segment.id, event.target.value)
                  setEditingId(null)
                }}
                className="w-full resize-none border border-[var(--color-brass)] bg-[var(--color-paper-raised)] p-2 text-lg leading-[2] outline-none sm:text-xl"
                rows={Math.max(1, Math.ceil(segment.clean.length / 60))}
              />
            ) : (
              <p
                onClick={() => !showRaw && setEditingId(segment.id)}
                className={
                  showRaw
                    ? 'text-[var(--color-ink-muted)]'
                    : 'cursor-text hover:bg-[var(--color-paper-raised)]'
                }
                title={showRaw ? undefined : 'انقر للتعديل'}
              >
                {showRaw ? segment.raw : segment.clean}
              </p>
            )}
          </div>
        ))}

        {partial.trim().length > 0 ? <p className="partial-text mt-1">{partial}</p> : null}
      </div>
    </section>
  )
}
