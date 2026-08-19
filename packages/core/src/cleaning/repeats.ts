import type { RemovedWord } from './fillers.js'

export interface CollapseRepeatsResult {
  readonly text: string
  readonly removed: readonly RemovedWord[]
}

/**
 * يطوي مدّ الحروف: «طيييييب» ← «طيب»، «شووووف» ← «شوف».
 *
 * لماذا الطيّ إلى حرف واحد آمن؟ لأن العربية لا تكتب ثلاثة حروف متطابقة
 * متتالية في كلمة أصيلة قط، فأي تكرار ثلاثي فأكثر هو مدّ في النطق نقله المحرك.
 */
export function collapseElongatedLetters(text: string): string {
  return text.replace(/(\S)\1{2,}/gu, '$1')
}

/** يجرّد الكلمة من علامات الترقيم للمقارنة فقط — النص الأصلي لا يتغيّر. */
function comparableForm(token: string): string {
  return token.replace(/[.,!?;:،؛؟…"'«»()[\]{}]/gu, '').toLowerCase()
}

/**
 * يطوي التلعثم: تكرار الكلمة أو العبارة القصيرة مباشرةً بعد نفسها.
 *
 * «أنا أنا أنا رحت» ← «أنا رحت»
 * «رحت المدرسة رحت المدرسة أمس» ← «رحت المدرسة أمس»
 *
 * يعالج التكرار بطول كلمة واحدة وكلمتين فقط. ثلاث كلمات فأكثر لم تُعالَج
 * عمدًا: تكرار عبارة من ثلاث كلمات في الكلام يكون مقصودًا للتأكيد غالبًا.
 */
export function collapseRepeatedWords(text: string): CollapseRepeatsResult {
  const tokens = text.split(/(\s+)/u)
  const words: Array<{ token: string; index: number }> = []
  tokens.forEach((token, index) => {
    if (token.trim().length > 0) words.push({ token, index })
  })

  const dropIndices = new Set<number>()
  const removed: RemovedWord[] = []

  // تكرار عبارة من كلمتين: A B A B ← A B
  for (let i = 0; i + 3 < words.length; i++) {
    if (dropIndices.has(words[i]!.index)) continue
    const [first, second, third, fourth] = [words[i]!, words[i + 1]!, words[i + 2]!, words[i + 3]!]
    if (
      comparableForm(first.token) === comparableForm(third.token) &&
      comparableForm(second.token) === comparableForm(fourth.token) &&
      comparableForm(first.token).length > 0
    ) {
      dropIndices.add(third.index)
      dropIndices.add(fourth.index)
      removed.push({ text: `${third.token} ${fourth.token}`, reason: 'repetition' })
    }
  }

  // تكرار كلمة واحدة متتالية
  let previous: string | null = null
  for (const word of words) {
    if (dropIndices.has(word.index)) continue
    const current = comparableForm(word.token)
    if (current.length > 0 && current === previous) {
      dropIndices.add(word.index)
      removed.push({ text: word.token, reason: 'repetition' })
    } else {
      previous = current
    }
  }

  if (dropIndices.size === 0) return { text, removed: [] }

  const kept = tokens
    .map((token, index) => (dropIndices.has(index) ? '' : token))
    .join('')

  return { text: kept, removed }
}

/** يطبّق طيّ الحروف الممدودة ثم طيّ الكلمات المكررة. */
export function collapseRepeats(text: string): CollapseRepeatsResult {
  return collapseRepeatedWords(collapseElongatedLetters(text))
}
