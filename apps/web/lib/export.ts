import type { Segment } from '@arabic-v2t/core'

/** يصوغ الزمن بصيغة SRT: HH:MM:SS,mmm */
function formatSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const milliseconds = Math.floor(ms % 1000)

  return (
    `${String(hours).padStart(2, '0')}:` +
    `${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')},` +
    String(milliseconds).padStart(3, '0')
  )
}

/**
 * يحوّل المقاطع إلى ملف ترجمة SRT.
 *
 * الطوابع الزمنية للمقاطع تأتي من المحرك مباشرة، فالملف صالح للاستعمال على
 * الفيديو الأصلي دون إعادة ضبط.
 */
export function segmentsToSrt(segments: readonly Segment[]): string {
  return segments
    .map((segment, index) => {
      const time = `${formatSrtTime(segment.startMs)} --> ${formatSrtTime(segment.endMs)}`
      return `${index + 1}\n${time}\n${segment.clean}\n`
    })
    .join('\n')
}
