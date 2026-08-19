import type { DialectDefinition } from '../types.js'
import { buildWordListPattern } from './boundaries.js'

/**
 * كلمات حشو مشتركة بين كل اللهجات — أصوات لا تحمل معنى، يخرجها المحرك
 * حرفيًا لأنه لا يفرّق بين الصوت والكلمة.
 */
export const universalFillers: readonly string[] = [
  'hmm',
  'hmmm',
  'mmm',
  'mm',
  'uhh',
  'uh',
  'umm',
  'um',
  'aaa',
  'eee',
  'ااا',
  'اااه',
  'امم',
  'ممم',
  'همم',
  'أمم',
]

export interface RemovedWord {
  readonly text: string
  readonly reason: 'filler' | 'repetition'
}

export interface StripFillersResult {
  readonly text: string
  readonly removed: readonly RemovedWord[]
}

/**
 * يحسب النطاقات المحمية في النص: المواضع التي تقع فيها كلمة حشو داخل
 * سياق يجعلها كلمة أصيلة، فلا تُحذف.
 *
 * مثال: «يعني» تُحذف في «يعني أنا رحت»، وتبقى في «هذا يعني أن الأمر انتهى».
 */
function computeProtectedRanges(text: string, dialect: DialectDefinition): Array<[number, number]> {
  const ranges: Array<[number, number]> = []

  for (const protectedWord of dialect.protectedWords ?? []) {
    // ننسخ التعبير النمطي بعلم `g` حتى لا نغيّر حالة الأصل المشترك بين الاستدعاءات
    const pattern = new RegExp(
      protectedWord.keepWhen.source,
      protectedWord.keepWhen.flags.includes('g')
        ? protectedWord.keepWhen.flags
        : `${protectedWord.keepWhen.flags}g`,
    )

    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      ranges.push([match.index, match.index + match[0].length])
      // حماية من الحلقة اللانهائية عند مطابقة فارغة
      if (match[0].length === 0) pattern.lastIndex += 1
    }
  }

  return ranges
}

function isInsideAnyRange(start: number, end: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([rangeStart, rangeEnd]) => start >= rangeStart && end <= rangeEnd)
}

/**
 * يحذف كلمات الحشو من النص.
 *
 * المبدأ الحاكم: **لا نحذف إلا ما لا يحمل معنى إطلاقًا.** كلمة مثل «يعني»
 * أو «ايه» تُحذف فقط حين لا يحميها سياقها؛ وكلمات مثل «طيب» و«ماشي» و«like»
 * لا تُدرج في قوائم الحشو أصلًا رغم شيوعها كحشو، لأن كلفة الحذف الخاطئ
 * (تشويه المعنى) أعلى بكثير من كلفة الإبقاء.
 */
export function stripFillers(text: string, dialect: DialectDefinition): StripFillersResult {
  const allFillers = [...new Set([...universalFillers, ...dialect.fillers])]
  const pattern = buildWordListPattern(allFillers)
  if (!pattern) return { text, removed: [] }

  const protectedRanges = computeProtectedRanges(text, dialect)
  const removed: RemovedWord[] = []

  const output = text.replace(pattern, (match, offset: number) => {
    if (isInsideAnyRange(offset, offset + match.length, protectedRanges)) {
      return match
    }
    removed.push({ text: match, reason: 'filler' })
    return ''
  })

  return { text: output, removed }
}
