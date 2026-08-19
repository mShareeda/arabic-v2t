'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { DialectSummary } from '@/lib/dialect-summary'
import { DialectPicker } from './dialect-picker'

export function WelcomeFlow({ dialects }: { dialects: DialectSummary[] }) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          اختر لغتك ولهجتك
        </h2>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          يضبط النظام محرك التعرّف على اللهجة المختارة، فتتحسّن دقة النص وأسلوب كتابته.
        </p>
      </div>

      <DialectPicker dialects={dialects} selectedId={selectedId} onSelect={setSelectedId} />

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={!selectedId}
          onClick={() => router.push(`/studio?dialect=${selectedId}`)}
          className="bg-[var(--color-ink)] px-7 py-3.5 text-[var(--color-paper)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          style={{ borderRadius: 'var(--radius-sharp)' }}
        >
          ابدأ التسجيل
        </button>

        {!selectedId ? (
          <span className="text-sm text-[var(--color-ink-faint)]">اختر لهجة للمتابعة</span>
        ) : null}
      </div>
    </div>
  )
}
