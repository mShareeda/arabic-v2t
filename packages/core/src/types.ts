import { z } from 'zod'

/**
 * الأنواع المشتركة بين الواجهة وخادم البث وطبقة التنظيف.
 * كل ما يعبر حدود الشبكة له مخطط Zod حتى نتحقق منه وقت التشغيل، لا وقت الترجمة فقط.
 */

// ─────────────────────────────────────────────────────────────
//  اللهجات
// ─────────────────────────────────────────────────────────────

/** عائلة اللهجة — تُستخدم للتجميع في الواجهة ولمشاركة قوائم الحشو. */
export const dialectFamilySchema = z.enum([
  'gulf',
  'egyptian',
  'levantine',
  'maghrebi',
  'msa',
  'english',
])
export type DialectFamily = z.infer<typeof dialectFamilySchema>

/** استبدال نصي يُطبَّق أثناء التطبيع، خاص بلهجة بعينها. */
export interface Replacement {
  readonly from: RegExp
  readonly to: string
  /** سبب الاستبدال — يظهر في رسائل الاختبارات ويوثّق القاعدة. */
  readonly note?: string
}

/** إعداد Speechmatics الخاص بلهجة. */
export interface SpeechmaticsEngineConfig {
  /** رمز اللغة عند Speechmatics. نموذجها العربي واحد (`ar`) يغطي كل اللهجات. */
  readonly language: string
  readonly operatingPoint: 'standard' | 'enhanced'
  /** أقصى تأخير بالثواني قبل تثبيت الجملة. أقل = أسرع ظهورًا، وأكثر عرضة للتصحيح. */
  readonly maxDelay: number
  /** مفردات محلية تُحيّز المحرك: أسماء مدن وتعابير خاصة باللهجة. */
  readonly additionalVocab?: readonly string[]
  /** الوضع ثنائي اللغة (عربي/إنجليزي) لالتقاط خلط اللغة داخل الجملة. */
  readonly enableCodeSwitching?: boolean
}

export interface GoogleEngineConfig {
  /** رمز اللوكيل عند Google، مثل ar-BH و ar-EG. */
  readonly languageCode: string
  readonly model: string
  readonly alternativeLanguageCodes?: readonly string[]
}

export interface WhisperEngineConfig {
  readonly language: string
  /** تلميح أولي يوجّه Whisper نحو اللهجة بدل تحويلها لفصحى. */
  readonly initialPrompt?: string
}

export interface DialectEngineConfig {
  readonly speechmatics: SpeechmaticsEngineConfig
  readonly google: GoogleEngineConfig
  readonly whisper: WhisperEngineConfig
}

/**
 * تعريف لهجة واحدة — هذا هو كامل سطح التوسّع في المشروع.
 * إضافة لهجة جديدة = ملف واحد بهذا الشكل + سطر في `src/dialects/index.ts`.
 * لا يوجد أي شرط `if` على مُعرّف اللهجة في أي مكان آخر من الكود.
 */
export interface DialectDefinition {
  /** مُعرّف ثابت يُخزَّن في قاعدة البيانات — لا يتغيّر بعد الإطلاق. */
  readonly id: string
  /** الاسم المعروض للمستخدم بلغته. */
  readonly label: string
  /** وصف قصير يظهر تحت الاسم في بطاقة الاختيار. */
  readonly description: string
  /** جملة نموذجية بهذه اللهجة — تُري المستخدم الفرق فورًا. */
  readonly sample: string
  readonly family: DialectFamily
  readonly direction: 'rtl' | 'ltr'
  /** رمز البلد كإيموجي علم، أو null للفصحى والعربية العامة. */
  readonly flag: string | null
  readonly engine: DialectEngineConfig
  /** كلمات الحشو الخاصة بهذه اللهجة (تُضاف إلى القائمة العامة). */
  readonly fillers: readonly string[]
  /** استثناءات سياقية تمنع حذف كلمة حشو حين تكون أصيلة في الجملة. */
  readonly protectedWords?: readonly ProtectedWord[]
  readonly replacements?: readonly Replacement[]
}

/**
 * كلمة تبدو حشوًا لكنها قد تكون أصيلة حسب سياقها.
 * مثال: «يعني» حشو في «يعني أنا رحت»، لكنها فعل أصيل في «هذا يعني أن الأمر انتهى».
 *
 * `keepWhen` نمط يجب أن **يشمل الكلمة نفسها** ضمن ما يطابقه؛ فكل موضع تقع فيه
 * الكلمة داخل مطابقة لهذا النمط يُستثنى من الحذف.
 */
export interface ProtectedWord {
  readonly word: string
  readonly keepWhen: RegExp
  readonly note?: string
}

// ─────────────────────────────────────────────────────────────
//  النصوص والمقاطع
// ─────────────────────────────────────────────────────────────

/** كلمة واحدة كما يعيدها المحرك، بطابعها الزمني. */
export const wordSchema = z.object({
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
})
export type Word = z.infer<typeof wordSchema>

/**
 * مقطع من التفريغ. نحفظ النص الخام والنظيف معًا دائمًا:
 * التنظيف لا يتلف البيانات الأصلية أبدًا، والمستخدم يستطيع الرجوع إليها.
 */
export const segmentSchema = z.object({
  id: z.string(),
  raw: z.string(),
  clean: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  /** الكلمات التي حذفتها طبقة التنظيف، مع سبب الحذف. */
  removed: z
    .array(
      z.object({
        text: z.string(),
        reason: z.enum(['filler', 'repetition']),
      }),
    )
    .default([]),
  /** هل يبدأ هذا المقطع فقرة جديدة (بسبب صمت طويل قبله)؟ */
  startsParagraph: z.boolean().default(false),
})
export type Segment = z.infer<typeof segmentSchema>

/** المخرج الخام من المحرك قبل أي تنظيف. */
export interface RawTranscript {
  readonly text: string
  readonly words: readonly Word[]
  readonly durationMs: number
}

// ─────────────────────────────────────────────────────────────
//  رسائل البث الحي بين المتصفح والـ gateway
// ─────────────────────────────────────────────────────────────

/** من المتصفح إلى الـ gateway. */
export const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('start'),
    dialectId: z.string(),
    /** معدل عينات الصوت الذي سيرسله المتصفح فعليًا. */
    sampleRate: z.number().int().positive(),
  }),
  z.object({ type: z.literal('stop') }),
  z.object({ type: z.literal('ping') }),
])
export type ClientMessage = z.infer<typeof clientMessageSchema>

/** من الـ gateway إلى المتصفح. */
export const serverMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ready'), sessionId: z.string(), dialectId: z.string() }),
  /** نص غير مستقر — يُستبدل بالكامل عند وصول التالي. */
  z.object({ type: z.literal('partial'), text: z.string() }),
  /** مقطع مثبَّت — يُضاف ولا يتغيّر. */
  z.object({ type: z.literal('segment'), segment: segmentSchema }),
  z.object({
    type: z.literal('done'),
    durationMs: z.number(),
    transcriptId: z.string().nullable(),
  }),
  z.object({
    type: z.literal('error'),
    code: z.enum([
      'unauthorized',
      'quota_exceeded',
      'session_limit',
      'unknown_dialect',
      'provider_error',
      'session_too_long',
      'internal',
    ]),
    message: z.string(),
  }),
  /** تحذير قرب انتهاء المدة المسموحة للجلسة. */
  z.object({
    type: z.literal('warning'),
    code: z.literal('nearing_limit'),
    remainingMs: z.number(),
  }),
  z.object({ type: z.literal('pong') }),
])
export type ServerMessage = z.infer<typeof serverMessageSchema>

// ─────────────────────────────────────────────────────────────
//  إعدادات التنظيف
// ─────────────────────────────────────────────────────────────

export const cleaningOptionsSchema = z.object({
  normalizeText: z.boolean().default(true),
  removeFillers: z.boolean().default(true),
  collapseRepeats: z.boolean().default(true),
  segmentByPause: z.boolean().default(true),
  fixPunctuation: z.boolean().default(true),
  /** فجوة الصمت (بالمللي ثانية) التي تُعتبر بداية فقرة جديدة. */
  paragraphGapMs: z.number().positive().default(1200),
})
export type CleaningOptions = z.infer<typeof cleaningOptionsSchema>

export const defaultCleaningOptions: CleaningOptions = cleaningOptionsSchema.parse({})
