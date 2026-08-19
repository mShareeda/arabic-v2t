/**
 * حدود الكلمات في النص العربي.
 *
 * لماذا لا نستخدم `\b`؟ لأن محرك التعبيرات النمطية في JavaScript يعتبر الحروف
 * العربية حروفًا «غير كلمية» (non-word)، فـ `\bاه\b` لا تطابق ما نتوقعه إطلاقًا.
 * البديل الصحيح: حدود صريحة بمحارف الفصل عبر lookahead/lookbehind.
 */

/** المحارف التي تُعتبر فاصلًا بين الكلمات: مسافات وعلامات ترقيم عربية ولاتينية. */
const SEPARATORS = '\\s.,!?;:،؛؟…"\'«»()\\[\\]{}\\-–—/\\\\'

/** بداية كلمة: إما بداية النص أو محرف فاصل. */
export const WORD_START = `(?<=^|[${SEPARATORS}])`

/** نهاية كلمة: إما نهاية النص أو محرف فاصل. */
export const WORD_END = `(?=$|[${SEPARATORS}])`

/** التطويل العربي (ـ) — قد يتخلل حروف الكلمة الواحدة. */
const TATWEEL = '\u0640'

/** تشكيل عربي: فتحة، ضمة، كسرة، شدة، سكون، تنوين، ألف خنجرية. */
export const DIACRITICS = /[\u064B-\u0652\u0653-\u0655\u0670\u06D6-\u06ED]/g

/** يهرّب المحارف الخاصة في التعبيرات النمطية. */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * يبني نمطًا يطابق كلمة مع تحمّل المدّ والتطويل.
 *
 * «امم» تصبح نمطًا يطابق «امم» و«اااممم» و«اـمـم» — لأن المتحدث يمدّ
 * حرف الحشو عادة، والمحرك ينقل هذا المدّ حرفيًا.
 */
export function elongationTolerantPattern(word: string): string {
  return [...word].map((char) => `${escapeRegExp(char)}+${TATWEEL}*`).join('')
}

/**
 * يبني تعبيرًا نمطيًا يطابق كلمة (أو عبارة) مستقلة بحدود عربية صحيحة.
 * استخدمه في `replacements` داخل ملفات اللهجات بدل `\b` التي لا تعمل مع العربية.
 */
export function wordRegex(word: string, flags = 'g'): RegExp {
  return new RegExp(`${WORD_START}${escapeRegExp(word)}${WORD_END}`, flags)
}

/** يبني تعبيرًا نمطيًا يطابق أيًّا من الكلمات المعطاة ككلمة مستقلة. */
export function buildWordListPattern(words: readonly string[]): RegExp | null {
  if (words.length === 0) return null
  // الأطول أولًا حتى لا تلتهم «اه» ما هو جزء من «اههه» بشكل جزئي
  const sorted = [...words].sort((a, b) => b.length - a.length)
  const alternatives = sorted.map(elongationTolerantPattern).join('|')
  return new RegExp(`${WORD_START}(?:${alternatives})${WORD_END}`, 'giu')
}
