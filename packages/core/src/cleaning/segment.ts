import type { Word } from '../types.js'

export interface RawSegment {
  readonly words: readonly Word[]
  readonly startMs: number
  readonly endMs: number
  /** فجوة صمت طويلة سبقت هذا المقطع، فيبدأ فقرة جديدة. */
  readonly startsParagraph: boolean
}

/** أقصى طول مقطع بالمحارف قبل التقسيم القسري — لإبقاء العرض قابلًا للقراءة. */
const MAX_SEGMENT_CHARS = 220

const SENTENCE_END = /[.؟?!…]\s*$/u

/**
 * يقسّم الكلمات إلى مقاطع.
 *
 * هذه هي معالجة «فترات الصمت الفارغة» المطلوبة: الصمت لا يُحذف كنص — هو أصلًا
 * ليس نصًا — بل يُترجم إلى **بنية**. فجوة تتجاوز الحد تصبح فاصل فقرة، فيقرأ
 * المستخدم نصًا مُهيكلًا بدل كتلة واحدة متصلة أو سطور فارغة متناثرة.
 */
export function segmentWords(words: readonly Word[], paragraphGapMs: number): RawSegment[] {
  if (words.length === 0) return []

  const segments: RawSegment[] = []
  let current: Word[] = []
  let currentChars = 0
  let startsParagraph = false

  const flush = (): void => {
    if (current.length === 0) return
    segments.push({
      words: current,
      startMs: current[0]!.startMs,
      endMs: current[current.length - 1]!.endMs,
      startsParagraph,
    })
    current = []
    currentChars = 0
    startsParagraph = false
  }

  for (const [index, word] of words.entries()) {
    const previous = index > 0 ? words[index - 1] : undefined
    const gapMs = previous ? word.startMs - previous.endMs : 0

    if (previous) {
      const longPause = gapMs >= paragraphGapMs
      const sentenceEnded = SENTENCE_END.test(previous.text)
      const tooLong = currentChars + word.text.length > MAX_SEGMENT_CHARS

      if (longPause || sentenceEnded || tooLong) {
        flush()
        startsParagraph = longPause
      }
    }

    current.push(word)
    currentChars += word.text.length + 1
  }

  flush()
  return segments
}

/** يجمع كلمات المقطع في نص واحد بمسافات مضبوطة. */
export function joinWords(words: readonly Word[]): string {
  return words
    .map((word) => word.text.trim())
    .filter((text) => text.length > 0)
    .join(' ')
    // علامة الترقيم تلتصق بما قبلها
    .replace(/\s+([،؛؟!:.…,;?])/gu, '$1')
}
