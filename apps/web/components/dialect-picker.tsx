'use client'

import type { DialectSummary } from '@/lib/dialect-summary'

interface DialectPickerProps {
  dialects: readonly DialectSummary[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/**
 * بطاقات اختيار اللهجة.
 *
 * كل بطاقة تحمل جملة نموذجية باللهجة نفسها («شلونك؟» مقابل «إزيك؟») — يفهم
 * المستخدم الفرق فورًا دون شرح. البطاقات تُبنى من سجل اللهجات، فإضافة لهجة
 * جديدة تظهر هنا تلقائيًا بلا تعديل في هذا الملف.
 */
export function DialectPicker({ dialects, selectedId, onSelect }: DialectPickerProps) {
  return (
    <ul className="grid gap-px border border-[var(--color-rule)] bg-[var(--color-rule)] sm:grid-cols-2">
      {dialects.map((dialect, index) => {
        const isSelected = dialect.id === selectedId

        return (
          <li key={dialect.id}>
            <button
              type="button"
              onClick={() => onSelect(dialect.id)}
              aria-pressed={isSelected}
              className={`group relative flex h-full w-full flex-col items-start gap-3 p-5 text-start transition-colors duration-150 sm:p-6 ${
                isSelected
                  ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                  : 'bg-[var(--color-paper)] hover:bg-[var(--color-paper-raised)]'
              }`}
            >
              <div className="flex w-full items-baseline justify-between gap-3">
                <span
                  className="section-index"
                  style={isSelected ? { color: 'var(--color-brass)' } : undefined}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {dialect.flag ? (
                  <span aria-hidden="true" className="text-lg leading-none">
                    {dialect.flag}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-lg font-semibold tracking-tight sm:text-xl">
                  {dialect.label}
                </span>
                <span
                  className={`text-sm ${
                    isSelected ? 'text-[var(--color-paper)]/70' : 'text-[var(--color-ink-muted)]'
                  }`}
                >
                  {dialect.description}
                </span>
              </div>

              {/* الجملة النموذجية — تُعرض باتجاه اللهجة نفسها لا باتجاه الصفحة */}
              <span
                dir={dialect.direction}
                className={`mt-auto border-t pt-3 text-sm ${
                  isSelected
                    ? 'border-[var(--color-paper)]/20 text-[var(--color-brass)]'
                    : 'border-[var(--color-rule)] text-[var(--color-ink-faint)]'
                } w-full`}
              >
                {dialect.sample}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
