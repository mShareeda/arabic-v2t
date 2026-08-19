import { randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import {
  cleanPartial,
  cleanText,
  findDialect,
  segmentWords,
  joinWords,
  defaultCleaningOptions,
  type DialectDefinition,
  type Segment,
  type ServerMessage,
  type TranscriptionProvider,
  type Word,
  clientMessageSchema,
} from '@arabic-v2t/core'
import { config } from './config.js'
import type { AuthenticatedUser } from './auth.js'
import { beginSession, checkQuota, endSession, sessionBudgetMs } from './quota.js'

/** ما يُسلَّم عند انتهاء الجلسة، لتحفظه طبقة التخزين. */
export interface CompletedSession {
  readonly userId: string
  readonly dialectId: string
  readonly segments: readonly Segment[]
  readonly durationMs: number
}

export type SessionPersister = (session: CompletedSession) => Promise<string | null>

/** أقصى حجم إطار صوت مقبول — حارس ضد عميل مُسيء يستهلك الذاكرة. */
const MAX_AUDIO_FRAME_BYTES = 64 * 1024

/**
 * جلسة تفريغ حية واحدة.
 *
 * تربط ثلاثة أطراف: المتصفح (صوت داخل، نص خارج)، والمحرك، وطبقة التنظيف.
 * وتفرض حدّي المدة والحصة، وتحفظ الناتج عند الانتهاء.
 */
export class LiveSession {
  private readonly id = randomUUID()
  private dialect: DialectDefinition | null = null
  private stream: Awaited<ReturnType<TranscriptionProvider['openStream']>> | null = null
  private readonly words: Word[] = []
  private startedAt = 0
  private limitTimer: NodeJS.Timeout | null = null
  private warnTimer: NodeJS.Timeout | null = null
  private finished = false
  private quotaCounted = false

  constructor(
    private readonly socket: WebSocket,
    private readonly user: AuthenticatedUser,
    private readonly provider: TranscriptionProvider,
    private readonly persist: SessionPersister | null,
  ) {
    socket.on('message', (data, isBinary) => {
      void this.handleMessage(data as Buffer, isBinary)
    })
    socket.on('close', () => void this.cleanup())
    socket.on('error', () => void this.cleanup())
  }

  private send(message: ServerMessage): void {
    if (this.socket.readyState === this.socket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  private fail(code: Extract<ServerMessage, { type: 'error' }>['code'], message: string): void {
    this.send({ type: 'error', code, message })
    this.socket.close()
  }

  private async handleMessage(data: Buffer, isBinary: boolean): Promise<void> {
    if (isBinary) {
      if (data.byteLength > MAX_AUDIO_FRAME_BYTES) return
      this.stream?.sendAudio(new Uint8Array(data))
      return
    }

    const parsed = clientMessageSchema.safeParse(safeJsonParse(data.toString()))
    if (!parsed.success) {
      this.fail('internal', 'رسالة غير مفهومة من العميل')
      return
    }

    switch (parsed.data.type) {
      case 'start':
        await this.start(parsed.data.dialectId, parsed.data.sampleRate)
        break
      case 'stop':
        await this.finish()
        break
      case 'ping':
        this.send({ type: 'pong' })
        break
    }
  }

  private async start(dialectId: string, sampleRate: number): Promise<void> {
    if (this.stream) return

    const dialect = findDialect(dialectId)
    if (!dialect) {
      this.fail('unknown_dialect', `لهجة غير معروفة: ${dialectId}`)
      return
    }

    const quota = checkQuota(this.user.id)
    if (!quota.allowed) {
      this.fail(
        quota.reason ?? 'quota_exceeded',
        quota.reason === 'session_limit'
          ? `تجاوزت الحد الأقصى للجلسات المتزامنة (${config.limits.maxConcurrentSessions})`
          : 'انتهت حصتك الشهرية من دقائق التفريغ',
      )
      return
    }

    this.dialect = dialect
    beginSession(this.user.id)
    this.quotaCounted = true

    try {
      this.stream = await this.provider.openStream({
        dialect,
        sampleRate,
        handlers: {
          onPartial: (text) => {
            this.send({ type: 'partial', text: cleanPartial(text, dialect) })
          },
          onFinal: ({ text, words }) => {
            this.handleFinal(text, words, dialect)
          },
          onError: (error) => {
            this.send({ type: 'error', code: 'provider_error', message: error.message })
          },
          onClose: () => {
            void this.finish()
          },
        },
      })
    } catch (error) {
      endSession(this.user.id, 0)
      this.quotaCounted = false
      this.fail('provider_error', error instanceof Error ? error.message : 'تعذّر بدء التفريغ')
      return
    }

    this.startedAt = Date.now()
    this.armLimits()
    this.send({ type: 'ready', sessionId: this.id, dialectId: dialect.id })
  }

  /** يضبط مؤقّتي التحذير والقطع حسب ميزانية الجلسة. */
  private armLimits(): void {
    const budgetMs = sessionBudgetMs(this.user.id)

    if (budgetMs > config.limits.warnBeforeMs) {
      this.warnTimer = setTimeout(() => {
        this.send({
          type: 'warning',
          code: 'nearing_limit',
          remainingMs: config.limits.warnBeforeMs,
        })
      }, budgetMs - config.limits.warnBeforeMs)
    }

    this.limitTimer = setTimeout(() => {
      this.send({
        type: 'error',
        code: 'session_too_long',
        message: 'انتهت المدة القصوى المسموحة للجلسة',
      })
      void this.finish()
    }, budgetMs)
  }

  /**
   * مقطع مثبَّت من المحرك.
   *
   * ننظّفه ونرسله فورًا ليراه المستخدم، ونحتفظ بكلماته لإعادة تقسيم كامل
   * عند الانتهاء — فحدود الفقرات لا تُعرف إلا بمعرفة الفجوة بين المقاطع.
   */
  private handleFinal(text: string, words: readonly Word[], dialect: DialectDefinition): void {
    const previousEndMs = this.words[this.words.length - 1]?.endMs ?? 0
    const startsParagraph =
      this.words.length > 0 &&
      (words[0]?.startMs ?? 0) - previousEndMs >= defaultCleaningOptions.paragraphGapMs

    this.words.push(...words)

    const result = cleanText(text, dialect)
    if (result.clean.trim().length === 0) return

    this.send({
      type: 'segment',
      segment: {
        id: randomUUID(),
        raw: result.raw,
        clean: result.clean,
        startMs: words[0]?.startMs ?? previousEndMs,
        endMs: words[words.length - 1]?.endMs ?? previousEndMs,
        removed: [...result.removed],
        startsParagraph,
      },
    })
  }

  /** يعيد بناء المقاطع من كل الكلمات — التقسيم النهائي بعد اكتمال التسجيل. */
  private buildFinalSegments(dialect: DialectDefinition): Segment[] {
    const rawSegments = segmentWords(this.words, defaultCleaningOptions.paragraphGapMs)
    const segments: Segment[] = []

    for (const rawSegment of rawSegments) {
      const result = cleanText(joinWords(rawSegment.words), dialect)
      if (result.clean.trim().length === 0) continue

      segments.push({
        id: randomUUID(),
        raw: result.raw,
        clean: result.clean,
        startMs: rawSegment.startMs,
        endMs: rawSegment.endMs,
        removed: [...result.removed],
        startsParagraph: rawSegment.startsParagraph,
      })
    }

    return segments
  }

  private async finish(): Promise<void> {
    if (this.finished) return
    this.finished = true

    this.clearTimers()

    const durationMs = this.startedAt > 0 ? Date.now() - this.startedAt : 0

    try {
      await this.stream?.finish()
    } catch {
      this.stream?.abort()
    }
    this.stream = null

    let transcriptId: string | null = null
    if (this.dialect && this.words.length > 0 && this.persist) {
      const segments = this.buildFinalSegments(this.dialect)
      if (segments.length > 0) {
        try {
          transcriptId = await this.persist({
            userId: this.user.id,
            dialectId: this.dialect.id,
            segments,
            durationMs,
          })
        } catch (error) {
          // فشل الحفظ لا يفقد المستخدم نصه — النص وصله مقطعًا مقطعًا أثناء الكلام
          console.error('تعذّر حفظ التفريغ:', error)
        }
      }
    }

    this.releaseQuota(durationMs)
    this.send({ type: 'done', durationMs, transcriptId })
    this.socket.close()
  }

  private releaseQuota(durationMs: number): void {
    if (!this.quotaCounted) return
    this.quotaCounted = false
    endSession(this.user.id, durationMs)
  }

  private clearTimers(): void {
    if (this.limitTimer) clearTimeout(this.limitTimer)
    if (this.warnTimer) clearTimeout(this.warnTimer)
    this.limitTimer = null
    this.warnTimer = null
  }

  /** تنظيف عند قطع الاتصال فجأة — يحرّر الحصة ولا يترك جلسة معلّقة. */
  private async cleanup(): Promise<void> {
    if (this.finished) return
    this.finished = true
    this.clearTimers()
    this.stream?.abort()
    this.stream = null
    this.releaseQuota(this.startedAt > 0 ? Date.now() - this.startedAt : 0)
  }
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}
