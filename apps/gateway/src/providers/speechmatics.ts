import { Blob } from 'node:buffer'
import WebSocket from 'ws'
import {
  ProviderError,
  type DialectDefinition,
  type FileTranscriptionOptions,
  type RawTranscript,
  type StreamOptions,
  type StreamSession,
  type TranscriptionProvider,
  type Word,
} from '@arabic-v2t/core'

/**
 * تنفيذ محرك Speechmatics.
 *
 * ملاحظة على اللهجات: Speechmatics يستخدم نموذجًا عربيًا واحدًا (`ar`) يغطي
 * الخليجي والمصري والشامي والمغاربي — لا رمز منفصل لكل لهجة. التخصيص يمر
 * عبر `additional_vocab` (تحيّز المفردات المحلية) وطبقة التنظيف عندنا.
 */

interface SpeechmaticsAlternative {
  content: string
  confidence?: number
}

interface SpeechmaticsResult {
  type: 'word' | 'punctuation' | 'speaker_change'
  start_time: number
  end_time: number
  /** علامة الترقيم تلتصق بالكلمة السابقة لا تنفصل عنها. */
  attaches_to?: 'previous' | 'next'
  alternatives?: SpeechmaticsAlternative[]
}

/** أي رسالة واردة من Speechmatics عبر الـ WebSocket. */
interface SpeechmaticsMessage {
  message: string
  metadata?: { start_time: number; end_time: number; transcript: string }
  results?: SpeechmaticsResult[]
  /** يحملان تفاصيل الخطأ في رسائل Error و Warning. */
  type?: string
  reason?: string
}

/** يحوّل نتائج Speechmatics إلى كلمات بطوابعها الزمنية، مع إلصاق الترقيم. */
export function resultsToWords(results: readonly SpeechmaticsResult[]): Word[] {
  const words: Word[] = []

  for (const result of results) {
    const content = result.alternatives?.[0]?.content
    if (!content) continue

    if (result.type === 'punctuation' && result.attaches_to !== 'next') {
      const previous = words[words.length - 1]
      if (previous) {
        words[words.length - 1] = {
          ...previous,
          text: previous.text + content,
          endMs: Math.round(result.end_time * 1000),
        }
        continue
      }
    }

    words.push({
      text: content,
      startMs: Math.round(result.start_time * 1000),
      endMs: Math.round(result.end_time * 1000),
      ...(result.alternatives?.[0]?.confidence !== undefined
        ? { confidence: result.alternatives[0].confidence }
        : {}),
    })
  }

  return words
}

function buildTranscriptionConfig(dialect: DialectDefinition): Record<string, unknown> {
  const engine = dialect.engine.speechmatics

  return {
    language: engine.language,
    operating_point: engine.operatingPoint,
    enable_partials: true,
    max_delay: engine.maxDelay,
    ...(engine.additionalVocab && engine.additionalVocab.length > 0
      ? { additional_vocab: engine.additionalVocab.map((content) => ({ content })) }
      : {}),
  }
}

export class SpeechmaticsProvider implements TranscriptionProvider {
  readonly id = 'speechmatics' as const
  readonly supportsStreaming = true

  constructor(
    private readonly apiKey: string,
    private readonly region: string = 'eu2',
  ) {
    if (!apiKey) {
      throw new ProviderError(
        'مفتاح Speechmatics غير موجود. اضبط SPEECHMATICS_API_KEY في ملف .env',
        'speechmatics',
      )
    }
  }

  private get realtimeUrl(): string {
    return `wss://${this.region}.rt.speechmatics.com/v2`
  }

  private get batchUrl(): string {
    return 'https://asr.api.speechmatics.com/v2'
  }

  async openStream(options: StreamOptions): Promise<StreamSession> {
    const { dialect, sampleRate, handlers } = options

    const socket = new WebSocket(this.realtimeUrl, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })

    /** رقم تسلسلي لكل إطار صوت — Speechmatics يحتاجه في رسالة إنهاء البث. */
    let sequenceNumber = 0
    let closed = false
    let endOfTranscriptResolve: (() => void) | null = null

    await new Promise<void>((resolve, reject) => {
      const onOpen = (): void => {
        socket.send(
          JSON.stringify({
            message: 'StartRecognition',
            audio_format: { type: 'raw', encoding: 'pcm_s16le', sample_rate: sampleRate },
            transcription_config: buildTranscriptionConfig(dialect),
          }),
        )
      }

      const onFirstMessage = (data: WebSocket.RawData): void => {
        let parsed: { message?: string; reason?: string; type?: string }
        try {
          parsed = JSON.parse(data.toString()) as typeof parsed
        } catch {
          return
        }

        if (parsed.message === 'RecognitionStarted') {
          socket.off('message', onFirstMessage)
          socket.off('error', onEarlyError)
          resolve()
        } else if (parsed.message === 'Error') {
          reject(
            new ProviderError(
              `رفض Speechmatics بدء الجلسة: ${parsed.type ?? ''} ${parsed.reason ?? ''}`.trim(),
              'speechmatics',
            ),
          )
        }
      }

      const onEarlyError = (error: Error): void => {
        reject(new ProviderError('تعذّر الاتصال بـ Speechmatics', 'speechmatics', error))
      }

      socket.once('open', onOpen)
      socket.on('message', onFirstMessage)
      socket.once('error', onEarlyError)
    })

    socket.on('message', (data: WebSocket.RawData) => {
      let parsed: SpeechmaticsMessage
      try {
        parsed = JSON.parse(data.toString()) as SpeechmaticsMessage
      } catch {
        return
      }

      switch (parsed.message) {
        case 'AddPartialTranscript':
          handlers.onPartial(parsed.metadata?.transcript ?? '')
          break

        case 'AddTranscript': {
          const text = parsed.metadata?.transcript ?? ''
          if (text.trim().length === 0) break
          handlers.onFinal({ text, words: resultsToWords(parsed.results ?? []) })
          break
        }

        case 'EndOfTranscript':
          endOfTranscriptResolve?.()
          break

        case 'Error':
          handlers.onError(
            new ProviderError(
              `خطأ من Speechmatics: ${parsed.type ?? ''} ${parsed.reason ?? ''}`.trim(),
              'speechmatics',
            ),
          )
          break

        // AudioAdded و Info و Warning لا تتطلب إجراءً
        default:
          break
      }
    })

    socket.on('close', () => {
      closed = true
      // إن أُغلق الاتصال دون EndOfTranscript، نحرّر المنتظر حتى لا تعلق finish()
      endOfTranscriptResolve?.()
      handlers.onClose()
    })

    socket.on('error', (error: Error) => {
      handlers.onError(new ProviderError('انقطع الاتصال بـ Speechmatics', 'speechmatics', error))
    })

    return {
      get isOpen(): boolean {
        return !closed && socket.readyState === WebSocket.OPEN
      },

      sendAudio(chunk: Uint8Array): void {
        if (closed || socket.readyState !== WebSocket.OPEN) return
        socket.send(chunk)
        sequenceNumber += 1
      },

      async finish(): Promise<void> {
        if (closed || socket.readyState !== WebSocket.OPEN) return

        const waitForEnd = new Promise<void>((resolve) => {
          endOfTranscriptResolve = resolve
        })

        socket.send(JSON.stringify({ message: 'EndOfStream', last_seq_no: sequenceNumber }))

        // لا ننتظر إلى الأبد إن لم يردّ المحرك
        await Promise.race([
          waitForEnd,
          new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
        ])

        socket.close()
      },

      abort(): void {
        closed = true
        socket.terminate()
      },
    }
  }

  async transcribeFile(options: FileTranscriptionOptions): Promise<RawTranscript> {
    const { dialect, audio, fileName, onProgress } = options

    const jobConfig = {
      type: 'transcription',
      transcription_config: buildTranscriptionConfig(dialect),
    }

    const form = new FormData()
    form.append('config', JSON.stringify(jobConfig))
    form.append('data_file', new Blob([audio]) as unknown as globalThis.Blob, fileName)

    const createResponse = await fetch(`${this.batchUrl}/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    })

    if (!createResponse.ok) {
      throw new ProviderError(
        `تعذّر إنشاء مهمة التفريغ (${createResponse.status}): ${await createResponse.text()}`,
        'speechmatics',
      )
    }

    const { id: jobId } = (await createResponse.json()) as { id: string }
    onProgress?.(0.1)

    const transcript = await this.pollForTranscript(jobId, onProgress)
    onProgress?.(1)
    return transcript
  }

  private async pollForTranscript(
    jobId: string,
    onProgress?: (fraction: number) => void,
  ): Promise<RawTranscript> {
    const startedAt = Date.now()
    const timeoutMs = 30 * 60_000
    let delayMs = 2_000

    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      // تباعد تصاعدي حتى 15 ثانية — الملفات الطويلة لا تحتاج استعلامًا كل ثانيتين
      delayMs = Math.min(delayMs * 1.5, 15_000)

      const statusResponse = await fetch(`${this.batchUrl}/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })

      if (!statusResponse.ok) {
        throw new ProviderError(
          `تعذّر الاستعلام عن حالة المهمة (${statusResponse.status})`,
          'speechmatics',
        )
      }

      const { job } = (await statusResponse.json()) as { job: { status: string } }

      if (job.status === 'done') return this.fetchTranscript(jobId)
      if (job.status === 'rejected' || job.status === 'expired') {
        throw new ProviderError(`فشلت مهمة التفريغ بحالة: ${job.status}`, 'speechmatics')
      }

      onProgress?.(Math.min(0.9, 0.1 + (Date.now() - startedAt) / timeoutMs))
    }

    throw new ProviderError('انتهت مهلة انتظار التفريغ الدفعي', 'speechmatics')
  }

  private async fetchTranscript(jobId: string): Promise<RawTranscript> {
    const response = await fetch(`${this.batchUrl}/jobs/${jobId}/transcript?format=json-v2`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })

    if (!response.ok) {
      throw new ProviderError(`تعذّر جلب النص (${response.status})`, 'speechmatics')
    }

    const payload = (await response.json()) as {
      results?: SpeechmaticsResult[]
      job?: { duration?: number }
    }

    const words = resultsToWords(payload.results ?? [])

    return {
      text: words.map((word) => word.text).join(' '),
      words,
      durationMs: payload.job?.duration
        ? payload.job.duration * 1000
        : (words[words.length - 1]?.endMs ?? 0),
    }
  }
}
