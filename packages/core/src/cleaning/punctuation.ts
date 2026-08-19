/**
 * ضبط علامات الترقيم والمسافات بعد الحذف.
 *
 * حذف كلمة حشو يخلّف وراءه فراغات وفواصل يتيمة: «اه، أنا رحت» تصبح
 * «، أنا رحت». هذه الطبقة تنظّف هذه الآثار.
 */

const ARABIC_CHAR = /[؀-ۿ]/

/** علامات ترقيم لا يسبقها فراغ ويليها فراغ واحد. */
const TRAILING_PUNCTUATION = /\s+([،؛؟!:.…,;?])/gu

/** علامة ترقيم متبوعة مباشرة بحرف — نضيف مسافة. */
const MISSING_SPACE_AFTER = /([،؛؟!:,;?])(?=[^\s\d.،؛؟!:,;?])/gu

export function fixPunctuation(text: string): string {
  let output = text

  // فواصل يتيمة في بداية النص أو بعد فتح قوس، خلّفها حذف كلمة حشو
  output = output.replace(/^[\s]*[،؛,.…]+\s*/u, '')
  output = output.replace(/([(«"'[])\s*[،؛,]+\s*/gu, '$1')

  // علامتا ترقيم متتاليتان أو أكثر ← الأولى فقط (مع استثناء «...» و«؟!»)
  output = output.replace(/([،؛,])\s*(?=[،؛,])/gu, '')

  output = output.replace(TRAILING_PUNCTUATION, '$1')
  output = output.replace(MISSING_SPACE_AFTER, '$1 ')

  // توحيد المسافات
  output = output.replace(/[ \t]{2,}/gu, ' ')
  output = output.replace(/ *\n */gu, '\n')
  output = output.replace(/\n{3,}/gu, '\n\n')

  return output.trim()
}

/**
 * يحوّل علامات الترقيم اللاتينية إلى نظيراتها العربية داخل النص العربي.
 * لا يمس النص اللاتيني — «Hello, world» تبقى كما هي.
 */
export function localizePunctuation(text: string, direction: 'rtl' | 'ltr'): string {
  if (direction !== 'rtl') return text

  return text.replace(/[,;?]/gu, (match, offset: number, whole: string) => {
    const before = whole.slice(Math.max(0, offset - 2), offset)
    const after = whole.slice(offset + 1, offset + 3)
    const nearArabic = ARABIC_CHAR.test(before) || ARABIC_CHAR.test(after)
    if (!nearArabic) return match
    return match === ',' ? '،' : match === ';' ? '؛' : '؟'
  })
}
