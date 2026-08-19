'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Segment } from '@arabic-v2t/core'
import type { DialectSummary } from '@/lib/dialect-summary'

interface FileUploadProps {
  dialect: DialectSummary
  onResult: (segments: Segment[], durationMs: number) => void
}

/** أنواع الصوت المقبولة — يتولّى المحرك فك ترميزها. */
const ACCEPTED = 'audio/*,video/mp4,.m4a,.mp3,.wav,.ogg,.opus,.flac,.webm'
const MAX_BYTES = 50 * 1024 * 1024

type State = 'idle' | 'uploading' | 'processing' | 'failed'

export function FileUpload({ dialect, onResult }: FileUploadProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const upload = useCallback(
    async (file: File): Promise<void> => {
      setError(null)
      setFileName(file.name)

      if (file.size > MAX_BYTES) {
        setError(
          `حجم الملف يتجاوز الحد المسموح (50MB). حجم ملفك ${Math.round(file.size / 1024 / 1024)}MB.`,
        )
        setState('failed')
        return
      }

      setState('uploading')

      try {
        setState('processing')

        // بلا تذكرة هنا: مسار /api/uploads يصدر تذكرته بنفسه من جلسة الكوكي،
        // فتذكرة يرسلها المتصفح تُتجاهل — وطلبها يضيف رحلة شبكة بلا فائدة
        const response = await fetch('/api/uploads', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            dialectId: dialect.id,
            fileName: file.name,
            audioBase64: await toBase64(file),
          }),
        })

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null
          setError(payload?.error ?? 'فشل تفريغ الملف')
          setState('failed')
          return
        }

        const payload = (await response.json()) as {
          segments: Segment[]
          durationMs: number
          transcriptId?: string | null
        }

        onResult(payload.segments, payload.durationMs)
        setState('idle')

        if (payload.transcriptId) {
          router.push(`/library/${payload.transcriptId}`)
        }
      } catch {
        setError('تعذّر رفع الملف. تحقّق من اتصالك.')
        setState('failed')
      }
    },
    [dialect.id, onResult, router],
  )

  const busy = state === 'uploading' || state === 'processing'

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          // نصفّر القيمة ليعمل اختيار نفس الملف مرة أخرى
          event.target.value = ''
        }}
      />

      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="border border-[var(--color-rule)] px-4 py-3 text-sm transition-colors hover:bg-[var(--color-paper-raised)] disabled:opacity-50"
      >
        {state === 'uploading'
          ? 'جاري الرفع…'
          : state === 'processing'
            ? `جاري تفريغ ${fileName ?? 'الملف'}…`
            : 'رفع ملف صوتي'}
      </button>

      {error ? (
        <p role="alert" className="border-s-2 border-[var(--color-coral)] px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * يحوّل الملف إلى base64.
 *
 * يمرّ عبر مسار الواجهة (لا مباشرة إلى الـ gateway) لأن التذكرة والحصة
 * تُفحصان هناك. base64 يضخّم الحجم نحو 33%، وهو مقبول عند سقف 50MB لكنه
 * أول ما يجب استبداله برفع متعدد الأجزاء عند رفع السقف.
 */
async function toBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // نبني السلسلة على دفعات: تمرير مصفوفة كاملة إلى fromCharCode
  // يتجاوز الحد الأقصى لوسائط الدالة ويتعطّل على الملفات الكبيرة
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }

  return btoa(binary)
}
