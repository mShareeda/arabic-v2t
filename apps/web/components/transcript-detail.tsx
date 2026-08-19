'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Segment } from '@arabic-v2t/core'
import { TranscriptView } from './transcript-view'
import { TranscriptActions } from './transcript-actions'

interface TranscriptDetailProps {
  id: string
  segments: Segment[]
  /** نص احتياطي حين تتعذّر قراءة المقاطع المخزّنة. */
  fallbackText: string
  direction: 'rtl' | 'ltr'
  dialectLabel: string
}

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'failed'

export function TranscriptDetail({
  id,
  segments: initialSegments,
  fallbackText,
  direction,
  dialectLabel,
}: TranscriptDetailProps) {
  const router = useRouter()
  const [segments, setSegments] = useState(initialSegments)
  const [saveState, setSaveState] = useState<SaveState>('clean')

  const editSegment = useCallback((segmentId: string, text: string) => {
    setSegments((previous) =>
      previous.map((segment) => (segment.id === segmentId ? { ...segment, clean: text } : segment)),
    )
    setSaveState('dirty')
  }, [])

  const save = useCallback(async () => {
    setSaveState('saving')
    try {
      const response = await fetch(`/api/transcripts/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ segments }),
      })
      setSaveState(response.ok ? 'saved' : 'failed')
    } catch {
      setSaveState('failed')
    }
  }, [id, segments])

  const remove = useCallback(async () => {
    if (!window.confirm('حذف هذا التفريغ نهائيا؟')) return
    const response = await fetch(`/api/transcripts/${id}`, { method: 'DELETE' })
    if (response.ok) router.push('/library')
  }, [id, router])

  if (segments.length === 0) {
    return (
      <div dir={direction} className="mt-8 whitespace-pre-wrap text-lg leading-[2]">
        {fallbackText}
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col">
      <TranscriptView
        segments={segments}
        partial=""
        direction={direction}
        onEditSegment={editSegment}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--color-rule)] pt-6">
        {saveState !== 'clean' ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saveState === 'saving'}
            className="bg-[var(--color-ink)] px-6 py-3 text-[var(--color-paper)] transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ borderRadius: 'var(--radius-sharp)' }}
          >
            {saveState === 'saving'
              ? 'جاري الحفظ…'
              : saveState === 'saved'
                ? 'حفظ ✓'
                : saveState === 'failed'
                  ? 'فشل الحفظ — أعد المحاولة'
                  : 'حفظ التعديلات'}
          </button>
        ) : null}

        <TranscriptActions segments={segments} dialectLabel={dialectLabel} direction={direction} />

        <button
          type="button"
          onClick={() => void remove()}
          className="ms-auto border border-[var(--color-rule)] px-4 py-3 text-sm text-[var(--color-coral)] transition-colors hover:bg-[var(--color-paper-raised)]"
        >
          حذف
        </button>
      </div>
    </div>
  )
}
