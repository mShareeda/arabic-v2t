import type { DialectDefinition, RawTranscript, Word } from '../types.js'

export type ProviderId = 'speechmatics' | 'google' | 'whisper'

/** الأحداث التي يبثّها المزوّد أثناء الجلسة الحية. */
export interface StreamHandlers {
  /** نص غير مستقر — يُستبدل بالكامل عند وصول التالي. */
  onPartial(text: string): void
  /** مقطع مثبَّت من المحرك، مع كلماته وطوابعها الزمنية. */
  onFinal(payload: { text: string; words: readonly Word[] }): void
  onError(error: Error): void
  /** أغلق المحرك الجلسة من طرفه. */
  onClose(): void
}

/** جلسة بث حية مفتوحة نحو المحرك. */
export interface StreamSession {
  /** يرسل إطار صوت خام (PCM 16-bit little-endian, mono). */
  sendAudio(chunk: Uint8Array): void
  /** ينهي الإرسال وينتظر آخر نص من المحرك. */
  finish(): Promise<void>
  /** إنهاء فوري بلا انتظار — للأخطاء وقطع الاتصال. */
  abort(): void
  readonly isOpen: boolean
}

export interface StreamOptions {
  readonly dialect: DialectDefinition
  /** معدل عينات الصوت القادم من العميل. */
  readonly sampleRate: number
  readonly handlers: StreamHandlers
}

export interface FileTranscriptionOptions {
  readonly dialect: DialectDefinition
  readonly audio: Uint8Array
  readonly fileName: string
  /** يُستدعى بتقدّم المعالجة من 0 إلى 1 حين يوفّره المزوّد. */
  readonly onProgress?: (fraction: number) => void
}

/**
 * الواجهة التي يلتزم بها كل محرك تفريغ.
 *
 * وجود هذه الواجهة هو ما يجعل تبديل المحرك تغييرًا في متغيّر بيئة واحد
 * (`STT_PROVIDER`) بدل إعادة كتابة الخادم. بقية المشروع لا تعرف اسم المحرك
 * المستخدم ولا شكل رسائله.
 */
export interface TranscriptionProvider {
  readonly id: ProviderId
  readonly supportsStreaming: boolean
  /** يفتح جلسة بث حية. يرمي خطأ إن كان `supportsStreaming` يساوي false. */
  openStream(options: StreamOptions): Promise<StreamSession>
  /** يفرّغ ملفًا صوتيًا كاملًا (الوضع الدفعي). */
  transcribeFile(options: FileTranscriptionOptions): Promise<RawTranscript>
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly providerId: ProviderId,
    override readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
