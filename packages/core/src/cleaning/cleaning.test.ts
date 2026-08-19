import { describe, expect, it } from 'vitest'
import { egyptian, english, gulfBahraini, modernStandardArabic } from '../dialects/index.js'
import { cleanPartial, cleanText, cleanTranscript } from './pipeline.js'
import { collapseElongatedLetters, collapseRepeatedWords } from './repeats.js'
import { stripFillers } from './fillers.js'
import { normalizeArabic } from './normalize.js'
import { fixPunctuation, localizePunctuation } from './punctuation.js'
import { segmentWords } from './segment.js'
import type { Word } from '../types.js'

describe('normalizeArabic', () => {
  it('يحذف التطويل والتشكيل', () => {
    expect(normalizeArabic('مَرْحَبــــاً')).toBe('مرحبا')
  })

  it('يحوّل الأرقام العربية-الهندية إلى غربية', () => {
    expect(normalizeArabic('عندي ٢٥ كتاب')).toBe('عندي 25 كتاب')
  })

  it('لا يوحّد الألف — الإملاء الصحيح يبقى كما هو', () => {
    expect(normalizeArabic('أحمد إبراهيم آدم')).toBe('أحمد إبراهيم آدم')
  })

  it('يطبّق تصحيحات الهمزة الخاصة باللهجة', () => {
    expect(normalizeArabic('انا رحت', gulfBahraini)).toBe('أنا رحت')
  })
})

describe('stripFillers', () => {
  it('يحذف كلمات الحشو الخليجية', () => {
    const { text } = stripFillers('اه أنا امم رحت السوق', gulfBahraini)
    expect(text.replace(/\s+/g, ' ').trim()).toBe('أنا رحت السوق')
  })

  it('يحذف الحشو الممدود مهما طال', () => {
    const { text } = stripFillers('اااااه رحت اممممم البيت', gulfBahraini)
    expect(text.replace(/\s+/g, ' ').trim()).toBe('رحت البيت')
  })

  it('يحذف الحشو الإنجليزي', () => {
    const { text } = stripFillers('So um I went uh to the store', english)
    expect(text.replace(/\s+/g, ' ').trim()).toBe('So I went to the store')
  })

  it('يسجّل ما حُذف مع سببه', () => {
    const { removed } = stripFillers('اه أنا امم رحت', gulfBahraini)
    expect(removed.map((r) => r.text.trim())).toEqual(['اه', 'امم'])
    expect(removed.every((r) => r.reason === 'filler')).toBe(true)
  })

  it('لا يحذف كلمة تحتوي حروف الحشو ضمنها', () => {
    // «اهتمام» تبدأ بـ «اه» لكنها كلمة كاملة — الحدود العربية تمنع الحذف
    const { text } = stripFillers('عندي اهتمام كبير', gulfBahraini)
    expect(text).toBe('عندي اهتمام كبير')
  })
})

describe('stripFillers — الاستثناءات السياقية', () => {
  it('يحذف «يعني» حين تكون حشوًا', () => {
    const { text } = stripFillers('يعني أنا رحت السوق', gulfBahraini)
    expect(text.replace(/\s+/g, ' ').trim()).toBe('أنا رحت السوق')
  })

  // تراجع مُثبَّت: النمط الحامي كان يطابق «أن» داخل «أنا»، فتنجو كل
  // «يعني أنا…» من الحذف رغم أنها حشو خالص.
  it('يحذف «يعني» قبل «أنا» ولا يخلط بينها وبين «أن»', () => {
    const { text } = stripFillers('يعني أنا تعبت', gulfBahraini)
    expect(text.replace(/\s+/g, ' ').trim()).toBe('أنا تعبت')
  })

  it('يُبقي «يعني» حين تكون فعلًا أصيلًا', () => {
    const { text } = stripFillers('هذا يعني أن الأمر انتهى', gulfBahraini)
    expect(text).toBe('هذا يعني أن الأمر انتهى')
  })

  it('يُبقي «ايه» المصرية كأداة استفهام', () => {
    const { text } = stripFillers('عايز ايه مني؟', egyptian)
    expect(text).toBe('عايز ايه مني؟')
  })

  it('يحذف «ايه» المصرية حين تكون حشوًا', () => {
    const { text } = stripFillers('ايه أنا رحت المدرسة', egyptian)
    expect(text.replace(/\s+/g, ' ').trim()).toBe('أنا رحت المدرسة')
  })

  it('يُبقي «يعني إيه» المصرية كتركيب أصيل', () => {
    const { text } = stripFillers('يعني إيه الكلام ده؟', egyptian)
    expect(text).toBe('يعني إيه الكلام ده؟')
  })
})

describe('collapseElongatedLetters', () => {
  it('يطوي مدّ الحروف', () => {
    expect(collapseElongatedLetters('طيييييب')).toBe('طيب')
  })

  it('لا يمس الحرف المكرر مرتين — «الله» تبقى كما هي', () => {
    expect(collapseElongatedLetters('الله')).toBe('الله')
  })
})

describe('collapseRepeatedWords', () => {
  it('يطوي تكرار الكلمة الواحدة', () => {
    const { text } = collapseRepeatedWords('أنا أنا أنا رحت')
    expect(text.replace(/\s+/g, ' ').trim()).toBe('أنا رحت')
  })

  it('يطوي تكرار عبارة من كلمتين', () => {
    const { text } = collapseRepeatedWords('رحت المدرسة رحت المدرسة أمس')
    expect(text.replace(/\s+/g, ' ').trim()).toBe('رحت المدرسة أمس')
  })

  it('لا يطوي كلمتين مختلفتين متجاورتين', () => {
    const { text } = collapseRepeatedWords('رحت المدرسة والبيت')
    expect(text).toBe('رحت المدرسة والبيت')
  })

  it('يسجّل التكرار المحذوف بسببه', () => {
    const { removed } = collapseRepeatedWords('أنا أنا رحت')
    expect(removed).toHaveLength(1)
    expect(removed[0]?.reason).toBe('repetition')
  })
})

describe('fixPunctuation', () => {
  it('يحذف الفاصلة اليتيمة في بداية النص بعد حذف الحشو', () => {
    expect(fixPunctuation('، أنا رحت')).toBe('أنا رحت')
  })

  it('يلصق علامة الترقيم بما قبلها ويفصلها عما بعدها', () => {
    expect(fixPunctuation('أنا رحت ، ثم عدت')).toBe('أنا رحت، ثم عدت')
  })

  it('يوحّد المسافات المتعددة', () => {
    expect(fixPunctuation('أنا     رحت')).toBe('أنا رحت')
  })

  it('يطوي الفواصل المتتالية', () => {
    expect(fixPunctuation('أنا،، رحت')).toBe('أنا، رحت')
  })
})

describe('localizePunctuation', () => {
  it('يحوّل الفاصلة اللاتينية إلى عربية داخل النص العربي', () => {
    expect(localizePunctuation('أنا رحت, ثم عدت', 'rtl')).toBe('أنا رحت، ثم عدت')
  })

  it('لا يمس علامات الترقيم في النص اللاتيني', () => {
    expect(localizePunctuation('Hello, world', 'rtl')).toBe('Hello, world')
  })

  it('لا يفعل شيئًا في اللهجات اللاتينية', () => {
    expect(localizePunctuation('أنا رحت, ثم عدت', 'ltr')).toBe('أنا رحت, ثم عدت')
  })
})

describe('cleanText — التمرير الكامل', () => {
  it('ينظّف جملة خليجية واقعية', () => {
    const { clean } = cleanText('اه، يعني انا انا رحت امم للمنامة', gulfBahraini)
    expect(clean).toBe('أنا رحت للمنامة')
  })

  it('ينظّف جملة مصرية واقعية', () => {
    const { clean } = cleanText('اه، يعني انا رحت امم المدرسة', egyptian)
    expect(clean).toBe('أنا رحت المدرسة')
  })

  it('ينظّف جملة إنجليزية واقعية', () => {
    const { clean } = cleanText('Um, I I went uh to the office', english)
    expect(clean).toBe('I went to the office')
  })

  it('يحفظ النص الخام دون تعديل — لا نتلف البيانات الأصلية أبدًا', () => {
    const input = 'اه، يعني انا رحت'
    const { raw } = cleanText(input, gulfBahraini)
    expect(raw).toBe(input)
  })

  it('يحترم تعطيل خطوات التنظيف', () => {
    const { clean } = cleanText('اه أنا رحت', gulfBahraini, {
      normalizeText: false,
      removeFillers: false,
      collapseRepeats: false,
      segmentByPause: false,
      fixPunctuation: false,
      paragraphGapMs: 1200,
    })
    expect(clean).toBe('اه أنا رحت')
  })

  it('لا يفسد جملة نظيفة أصلًا', () => {
    const input = 'اجتمع الفريق صباح اليوم لمناقشة الخطة'
    expect(cleanText(input, modernStandardArabic).clean).toBe(input)
  })
})

describe('cleanPartial — التمرير السريع للنص الحي', () => {
  it('يحذف الحشو دون انتظار تثبيت الجملة', () => {
    expect(cleanPartial('اه أنا رحت', gulfBahraini).trim()).toBe('أنا رحت')
  })

  it('لا يقصّ المسافة النهائية — الجملة ما زالت قيد الكتابة', () => {
    expect(cleanPartial('أنا رحت ', gulfBahraini)).toBe('أنا رحت ')
  })

  it('يطبّع النص فلا يومض «انا» ثم «أنا» عند التثبيت', () => {
    expect(cleanPartial('انا رحت', gulfBahraini)).toBe('أنا رحت')
  })

  // «اه، السلام» ← حذف «اه» يترك فاصلة يتيمة تتصدّر النص الحي
  it('يقصّ علامة الترقيم اليتيمة التي خلّفها حذف الحشو', () => {
    expect(cleanPartial('اه، السلام عليكم', gulfBahraini)).toBe('السلام عليكم')
  })
})

describe('segmentWords — ترجمة الصمت إلى بنية', () => {
  const word = (text: string, startMs: number, endMs: number): Word => ({ text, startMs, endMs })

  it('يبدأ فقرة جديدة بعد صمت طويل', () => {
    const words = [
      word('أنا', 0, 400),
      word('رحت', 400, 800),
      word('وبعدين', 2500, 3000), // فجوة 1700ms
    ]
    const segments = segmentWords(words, 1200)
    expect(segments).toHaveLength(2)
    expect(segments[1]?.startsParagraph).toBe(true)
  })

  it('لا يقسّم عند فجوة قصيرة', () => {
    const words = [word('أنا', 0, 400), word('رحت', 700, 1000)]
    expect(segmentWords(words, 1200)).toHaveLength(1)
  })

  it('يقسّم عند نهاية الجملة', () => {
    const words = [word('رحت.', 0, 400), word('ثم', 500, 700), word('عدت', 700, 900)]
    const segments = segmentWords(words, 1200)
    expect(segments).toHaveLength(2)
    expect(segments[1]?.startsParagraph).toBe(false)
  })

  it('يعيد مصفوفة فارغة لمدخل فارغ', () => {
    expect(segmentWords([], 1200)).toEqual([])
  })
})

describe('cleanTranscript — تفريغ كامل', () => {
  const word = (text: string, startMs: number, endMs: number): Word => ({ text, startMs, endMs })

  it('ينظّف المقاطع ويفصل الفقرات بالصمت', () => {
    const result = cleanTranscript(
      {
        text: 'اه أنا رحت للمنامة امم وبعدين رجعت',
        words: [
          word('اه', 0, 300),
          word('أنا', 300, 600),
          word('رحت', 600, 900),
          word('للمنامة', 900, 1400),
          word('امم', 3000, 3300),
          word('وبعدين', 3300, 3800),
          word('رجعت', 3800, 4200),
        ],
        durationMs: 4200,
      },
      gulfBahraini,
    )

    expect(result.segments).toHaveLength(2)
    expect(result.segments[0]?.clean).toBe('أنا رحت للمنامة')
    expect(result.segments[1]?.clean).toBe('وبعدين رجعت')
    expect(result.cleanText).toBe('أنا رحت للمنامة\n\nوبعدين رجعت')
    expect(result.removedCount).toBe(2)
  })

  it('يحتفظ بالنص الخام لكل مقطع', () => {
    const result = cleanTranscript(
      {
        text: 'اه أنا رحت',
        words: [word('اه', 0, 300), word('أنا', 300, 600), word('رحت', 600, 900)],
        durationMs: 900,
      },
      gulfBahraini,
    )
    expect(result.segments[0]?.raw).toBe('اه أنا رحت')
    expect(result.segments[0]?.clean).toBe('أنا رحت')
  })

  it('يُسقط المقطع الذي كان حشوًا خالصًا', () => {
    const result = cleanTranscript(
      {
        text: 'اه امم',
        words: [word('اه', 0, 300), word('امم', 300, 700)],
        durationMs: 700,
      },
      gulfBahraini,
    )
    expect(result.segments).toHaveLength(0)
  })

  it('يتعامل مع تفريغ بلا طوابع زمنية', () => {
    const result = cleanTranscript(
      { text: 'اه أنا رحت', words: [], durationMs: 900 },
      gulfBahraini,
    )
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.clean).toBe('أنا رحت')
  })

  it('يتعامل مع تفريغ فارغ تمامًا', () => {
    const result = cleanTranscript({ text: '', words: [], durationMs: 0 }, gulfBahraini)
    expect(result.segments).toHaveLength(0)
    expect(result.cleanText).toBe('')
  })
})
