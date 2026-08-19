import type {
  FileTranscriptionOptions,
  RawTranscript,
  StreamOptions,
  StreamSession,
  TranscriptionProvider,
  Word,
} from '@arabic-v2t/core'

/**
 * محرك وهمي للتطوير والاختبار — لا يتصل بأي خدمة خارجية.
 *
 * فائدته الحقيقية: تشغيل التطبيق كاملًا (الواجهة، البث الحي، التنظيف، الحفظ)
 * قبل إنشاء حساب Speechmatics أو صرف دقيقة واحدة. النصوص التي يبثّها محشوّة
 * بكلمات حشو وتكرار عمدًا، حتى تظهر طبقة التنظيف وهي تعمل.
 */

const SCRIPTS: Record<string, string[]> = {
  'ar-BH': [
    'اه، السلام عليكم',
    'يعني انا انا رحت امم للمنامة أمس',
    'وشفت وايد ناس هناك',
    'اممم بعدين رجعت البيت',
  ],
  'ar-EG': [
    'اه، إزيك عامل إيه',
    'يعني انا رحت امم المدرسة النهارده',
    'وقابلت أصحابي هناك',
    'اممم وبعدين رجعت البيت',
  ],
  'ar-MSA': [
    'أه، السلام عليكم ورحمة الله',
    'امم اجتمع الفريق صباح اليوم',
    'وناقشنا الخطة الجديدة بالتفصيل',
    'ااا ثم انتهى الاجتماع',
  ],
  'en-US': [
    'Um, hello everyone',
    'So I I went uh to the office today',
    'And we discussed the new plan',
    'Umm and then the meeting ended',
  ],
}

const FALLBACK_SCRIPT = SCRIPTS['ar-MSA'] as string[]

/** يبني كلمات بطوابع زمنية مصطنعة بمعدل 350ms للكلمة. */
function buildWords(text: string, offsetMs: number): Word[] {
  const parts = text.split(/\s+/).filter(Boolean)
  return parts.map((part, index) => ({
    text: part,
    startMs: offsetMs + index * 350,
    endMs: offsetMs + index * 350 + 300,
    confidence: 0.95,
  }))
}

export class MockProvider implements TranscriptionProvider {
  readonly id = 'speechmatics' as const
  readonly supportsStreaming = true

  async openStream(options: StreamOptions): Promise<StreamSession> {
    const { dialect, handlers } = options
    const script = SCRIPTS[dialect.id] ?? FALLBACK_SCRIPT

    let lineIndex = 0
    let elapsedMs = 0
    let closed = false
    const timers: NodeJS.Timeout[] = []

    /** يبثّ سطرًا: أولًا كلمة كلمة كنص جزئي، ثم السطر كاملًا كنص نهائي. */
    const emitLine = (): void => {
      if (closed || lineIndex >= script.length) return

      const line = script[lineIndex] as string
      const words = line.split(/\s+/).filter(Boolean)
      lineIndex += 1

      words.forEach((_, wordIndex) => {
        timers.push(
          setTimeout(
            () => {
              if (!closed) handlers.onPartial(words.slice(0, wordIndex + 1).join(' '))
            },
            wordIndex * 350 + 200,
          ),
        )
      })

      const lineDurationMs = words.length * 350 + 400
      const finalOffsetMs = elapsedMs
      elapsedMs += lineDurationMs

      timers.push(
        setTimeout(() => {
          if (closed) return
          handlers.onFinal({ text: line, words: buildWords(line, finalOffsetMs) })
          // فجوة صمت مصطنعة بين السطور تُظهر تقسيم الفقرات وهو يعمل
          elapsedMs += 1400
          emitLine()
        }, lineDurationMs),
      )
    }

    timers.push(setTimeout(emitLine, 400))

    const clearTimers = (): void => {
      for (const timer of timers) clearTimeout(timer)
      timers.length = 0
    }

    return {
      get isOpen(): boolean {
        return !closed
      },
      sendAudio(): void {
        // المحرك الوهمي يتجاهل الصوت الوارد — النص من سيناريو ثابت
      },
      async finish(): Promise<void> {
        closed = true
        clearTimers()
        handlers.onClose()
      },
      abort(): void {
        closed = true
        clearTimers()
      },
    }
  }

  async transcribeFile(options: FileTranscriptionOptions): Promise<RawTranscript> {
    const script = SCRIPTS[options.dialect.id] ?? FALLBACK_SCRIPT

    const words: Word[] = []
    let offsetMs = 0
    for (const line of script) {
      words.push(...buildWords(line, offsetMs))
      offsetMs += line.split(/\s+/).length * 350 + 1400
    }

    options.onProgress?.(1)

    return {
      text: script.join(' '),
      words,
      durationMs: offsetMs,
    }
  }
}
