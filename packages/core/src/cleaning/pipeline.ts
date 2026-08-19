import {
  type CleaningOptions,
  type DialectDefinition,
  type RawTranscript,
  type Segment,
  defaultCleaningOptions,
} from '../types.js'
import { normalizeArabic } from './normalize.js'
import { stripFillers, type RemovedWord } from './fillers.js'
import { collapseRepeats } from './repeats.js'
import { fixPunctuation, localizePunctuation } from './punctuation.js'
import { joinWords, segmentWords } from './segment.js'

export interface CleanResult {
  /** النص كما ورد من المحرك، بلا أي تعديل. */
  readonly raw: string
  readonly clean: string
  readonly removed: readonly RemovedWord[]
}

/**
 * تنظيف نص واحد — التمرير الكامل.
 *
 * الترتيب مقصود:
 *   ١. التطبيع أولًا، ليصل النص لبقية الخطوات بشكل موحّد
 *   ٢. حذف الحشو قبل طيّ المدّ، لأن الطيّ يشوّه كلمات الحشو الممدودة
 *      («امممم» ← «ام») فلا تعود تطابق القوائم
 *   ٣. طيّ التكرار بعد الحذف، ليلتقي المكرران بعد اختفاء الحشو بينهما
 *   ٤. ضبط الترقيم أخيرًا، لينظّف آثار كل ما سبق
 */
export function cleanText(
  raw: string,
  dialect: DialectDefinition,
  options: CleaningOptions = defaultCleaningOptions,
): CleanResult {
  let text = raw
  const removed: RemovedWord[] = []

  if (options.normalizeText) {
    text = normalizeArabic(text, dialect)
  }

  if (options.removeFillers) {
    const result = stripFillers(text, dialect)
    text = result.text
    removed.push(...result.removed)
  }

  if (options.collapseRepeats) {
    const result = collapseRepeats(text)
    text = result.text
    removed.push(...result.removed)
  }

  if (options.fixPunctuation) {
    text = localizePunctuation(text, dialect.direction)
    text = fixPunctuation(text)
  } else {
    text = text.replace(/[ \t]{2,}/gu, ' ').trim()
  }

  return { raw, clean: text, removed }
}

/**
 * تنظيف سريع للنص الجزئي (partial) أثناء الكلام.
 *
 * يعمل عشرات المرات في الثانية أثناء التسجيل، فيقتصر على الخطوتين اللتين
 * يلاحظهما المستخدم فورًا: حذف الحشو وطيّ التكرار. لا تطبيع ولا ضبط ترقيم —
 * النص الجزئي غير مستقر أصلًا وسيُستبدل بعد أجزاء من الثانية.
 */
export function cleanPartial(raw: string, dialect: DialectDefinition): string {
  const { text } = stripFillers(raw, dialect)
  const { text: collapsed } = collapseRepeats(text)
  return collapsed.replace(/[ \t]{2,}/gu, ' ').trimStart()
}

export interface CleanedTranscript {
  readonly segments: readonly Segment[]
  readonly rawText: string
  readonly cleanText: string
  readonly durationMs: number
  readonly removedCount: number
}

let segmentCounter = 0
function nextSegmentId(): string {
  segmentCounter += 1
  return `seg_${Date.now().toString(36)}_${segmentCounter.toString(36)}`
}

/**
 * تنظيف تفريغ كامل: تقسيم بالصمت ثم تنظيف كل مقطع على حدة.
 *
 * كل مقطع يحتفظ بنصّه الخام إلى جانب النظيف، فلا تُفقد البيانات الأصلية أبدًا
 * ويستطيع المستخدم التبديل بين العرضين ورؤية ما حُذف بالضبط.
 */
export function cleanTranscript(
  transcript: RawTranscript,
  dialect: DialectDefinition,
  options: CleaningOptions = defaultCleaningOptions,
): CleanedTranscript {
  const rawSegments = options.segmentByPause
    ? segmentWords(transcript.words, options.paragraphGapMs)
    : transcript.words.length > 0
      ? [
          {
            words: transcript.words,
            startMs: transcript.words[0]!.startMs,
            endMs: transcript.words[transcript.words.length - 1]!.endMs,
            startsParagraph: false,
          },
        ]
      : []

  // احتياط: تفريغ بلا طوابع زمنية (بعض المحركات لا تعيدها) — نعامله كمقطع واحد
  if (rawSegments.length === 0 && transcript.text.trim().length > 0) {
    const result = cleanText(transcript.text, dialect, options)
    return {
      segments: [
        {
          id: nextSegmentId(),
          raw: result.raw,
          clean: result.clean,
          startMs: 0,
          endMs: transcript.durationMs,
          removed: [...result.removed],
          startsParagraph: false,
        },
      ],
      rawText: transcript.text,
      cleanText: result.clean,
      durationMs: transcript.durationMs,
      removedCount: result.removed.length,
    }
  }

  const segments: Segment[] = []
  for (const rawSegment of rawSegments) {
    const rawSegmentText = joinWords(rawSegment.words)
    const result = cleanText(rawSegmentText, dialect, options)

    // مقطع لم يبق منه شيء بعد التنظيف (كان حشوًا خالصًا) يُسقط بالكامل
    if (result.clean.trim().length === 0) continue

    segments.push({
      id: nextSegmentId(),
      raw: result.raw,
      clean: result.clean,
      startMs: rawSegment.startMs,
      endMs: rawSegment.endMs,
      removed: [...result.removed],
      startsParagraph: rawSegment.startsParagraph,
    })
  }

  return {
    segments,
    rawText: segments.map((s) => s.raw).join(' '),
    cleanText: renderSegments(segments),
    durationMs: transcript.durationMs,
    removedCount: segments.reduce((total, segment) => total + segment.removed.length, 0),
  }
}

/** يجمع المقاطع في نص نهائي، بفواصل فقرات عند الصمت الطويل. */
export function renderSegments(segments: readonly Segment[]): string {
  return segments
    .map((segment, index) => {
      const separator = index === 0 ? '' : segment.startsParagraph ? '\n\n' : ' '
      return `${separator}${segment.clean}`
    })
    .join('')
    .trim()
}
