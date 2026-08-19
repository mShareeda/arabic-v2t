import { serverMessageSchema, type Segment, type ServerMessage } from '@arabic-v2t/core'
import { MicrophoneRecorder } from './recorder'

export interface LiveSessionHandlers {
  onReady(): void
  onPartial(text: string): void
  onSegment(segment: Segment): void
  onPeak(peak: number): void
  onWarning(remainingMs: number): void
  onDone(payload: { durationMs: number; transcriptId: string | null }): void
  onError(message: string): void
}

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? 'ws://localhost:4000'

/** يترجم رموز أخطاء الخادم إلى رسائل يفهمها المستخدم. */
function describeError(message: Extract<ServerMessage, { type: 'error' }>): string {
  switch (message.code) {
    case 'unauthorized':
      return 'انتهت جلستك. سجّل الدخول مرة أخرى.'
    case 'quota_exceeded':
      return 'انتهت حصتك الشهرية من دقائق التفريغ.'
    case 'session_limit':
      return 'لديك جلسة تفريغ أخرى مفتوحة. أغلقها ثم أعد المحاولة.'
    case 'session_too_long':
      return 'انتهت المدة القصوى المسموحة للتسجيل، وحُفظ ما فُرِّغ حتى الآن.'
    case 'unknown_dialect':
      return 'اللهجة المختارة غير متاحة.'
    case 'provider_error':
      return `تعذّر الوصول لمحرك التفريغ: ${message.message}`
    default:
      return message.message
  }
}

/**
 * جلسة تفريغ حية من طرف المتصفح.
 *
 * تربط الميكروفون بالـ gateway: الصوت يخرج إطارات ثنائية، والنص يعود
 * رسائل JSON. لا تتصل بمحرك التفريغ مباشرة إطلاقًا — المفتاح لا يغادر الخادم.
 */
export class LiveSession {
  private socket: WebSocket | null = null
  private readonly recorder = new MicrophoneRecorder()
  private stopping = false

  constructor(private readonly handlers: LiveSessionHandlers) {}

  get isActive(): boolean {
    return this.socket !== null
  }

  async start(dialectId: string, ticket: string | null): Promise<void> {
    if (this.socket) return
    this.stopping = false

    // نطلب الميكروفون أولًا: رفض المستخدم للإذن يجب ألا يفتح اتصالًا بلا داعٍ
    try {
      await this.recorder.start({
        onFrame: (frame) => {
          this.handlers.onPeak(frame.peak)
          if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(frame.pcm)
          }
        },
        onError: (error) => this.handlers.onError(error.message),
      })
    } catch (error) {
      this.handlers.onError(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'لم يُسمح باستخدام الميكروفون. فعّل الإذن من إعدادات المتصفح.'
          : 'تعذّر الوصول إلى الميكروفون.',
      )
      return
    }

    const url = ticket ? `${GATEWAY_URL}/live?ticket=${ticket}` : `${GATEWAY_URL}/live`
    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    this.socket = socket

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: 'start',
          dialectId,
          sampleRate: this.recorder.sampleRate,
        }),
      )
    }

    socket.onmessage = (event: MessageEvent<string>) => {
      const parsed = serverMessageSchema.safeParse(safeJsonParse(event.data))
      if (!parsed.success) return
      this.handleMessage(parsed.data)
    }

    socket.onerror = () => {
      if (!this.stopping) this.handlers.onError('انقطع الاتصال بالخادم.')
    }

    socket.onclose = () => {
      void this.teardown()
    }
  }

  private handleMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'ready':
        this.handlers.onReady()
        break
      case 'partial':
        this.handlers.onPartial(message.text)
        break
      case 'segment':
        this.handlers.onSegment(message.segment)
        break
      case 'warning':
        this.handlers.onWarning(message.remainingMs)
        break
      case 'done':
        this.handlers.onDone({
          durationMs: message.durationMs,
          transcriptId: message.transcriptId,
        })
        break
      case 'error':
        this.handlers.onError(describeError(message))
        break
      case 'pong':
        break
    }
  }

  /** إنهاء نظيف: نوقف الميكروفون ثم نطلب من الخادم إغلاق الجلسة. */
  async stop(): Promise<void> {
    if (!this.socket || this.stopping) return
    this.stopping = true

    await this.recorder.stop()

    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'stop' }))
    } else {
      await this.teardown()
    }
  }

  private async teardown(): Promise<void> {
    this.socket = null
    if (this.recorder.isRecording) await this.recorder.stop()
  }
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input)
  } catch {
    return null
  }
}
