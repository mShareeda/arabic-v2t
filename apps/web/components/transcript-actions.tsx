'use client'

import { useState } from 'react'
import type { Segment } from '@arabic-v2t/core'
import { renderSegments } from '@arabic-v2t/core'
import { segmentsToSrt } from '@/lib/export'

interface TranscriptActionsProps {
  segments: readonly Segment[]
  dialectLabel: string
}

function download(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

export function TranscriptActions({ segments, dialectLabel }: TranscriptActionsProps) {
  const [copied, setCopied] = useState(false)

  if (segments.length === 0) return null

  const text = renderSegments(segments)
  const baseName = `تفريغ-${dialectLabel}-${new Date().toISOString().slice(0, 10)}`

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // بعض المتصفحات تمنع الحافظة خارج السياق الآمن (HTTP) — نتجاهل بصمت
    }
  }

  const buttonClass =
    'border border-[var(--color-rule)] px-4 py-3 text-sm transition-colors hover:bg-[var(--color-paper-raised)]'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => void copy()} className={buttonClass}>
        {copied ? 'نُسخ ✓' : 'نسخ'}
      </button>

      <button
        type="button"
        onClick={() => download(`${baseName}.txt`, text, 'text/plain')}
        className={buttonClass}
      >
        تنزيل نص
      </button>

      <button
        type="button"
        onClick={() => download(`${baseName}.srt`, segmentsToSrt(segments), 'application/x-subrip')}
        className={buttonClass}
      >
        تنزيل ترجمة SRT
      </button>
    </div>
  )
}
