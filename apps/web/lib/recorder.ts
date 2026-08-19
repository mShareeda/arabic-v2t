/** إطار صوت جاهز للإرسال، مع ذروة سعته لرسم المؤشر. */
export interface AudioFrame {
  readonly pcm: ArrayBuffer
  readonly peak: number
}

export interface RecorderHandlers {
  onFrame(frame: AudioFrame): void
  onError(error: Error): void
}

/**
 * التقاط الصوت من الميكروفون وتحويله إلى PCM 16-bit.
 *
 * ملاحظة على Safari في iOS: لا يبدأ `AudioContext` إلا بعد تفاعل مباشر من
 * المستخدم، ويبقى في حالة `suspended` حتى لو أُنشئ داخل معالج نقرة. لذلك
 * نستدعي `resume()` صراحة بعد الإنشاء بدل الاعتماد على البدء التلقائي.
 */
export class MicrophoneRecorder {
  private context: AudioContext | null = null
  private stream: MediaStream | null = null
  private worklet: AudioWorkletNode | null = null

  /** معدل العينات الفعلي — قد يخالف المطلوب حسب الجهاز والمتصفح. */
  private actualSampleRate = 16_000

  get sampleRate(): number {
    return this.actualSampleRate
  }

  get isRecording(): boolean {
    return this.context !== null
  }

  async start(handlers: RecorderHandlers): Promise<void> {
    if (this.context) return

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    // نطلب 16kHz لأنه ما يتوقّعه المحرك. بعض المتصفحات تتجاهل الطلب وتعطي
    // 48kHz، فنقرأ القيمة الفعلية ونبلّغ بها الخادم بدل افتراض ما طلبناه.
    const AudioContextClass =
      window.AudioContext ??
      (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextClass) {
      throw new Error('متصفحك لا يدعم Web Audio API')
    }

    this.context = new AudioContextClass({ sampleRate: 16_000 })
    this.actualSampleRate = this.context.sampleRate

    // ضروري لـ Safari على iOS — لا يبدأ السياق تلقائيًا
    if (this.context.state === 'suspended') {
      await this.context.resume()
    }

    await this.context.audioWorklet.addModule('/pcm-worklet.js')

    const source = this.context.createMediaStreamSource(this.stream)
    this.worklet = new AudioWorkletNode(this.context, 'pcm-processor')

    this.worklet.port.onmessage = (event: MessageEvent<AudioFrame>) => {
      handlers.onFrame(event.data)
    }

    this.worklet.onprocessorerror = () => {
      handlers.onError(new Error('توقف معالج الصوت بشكل غير متوقع'))
    }

    source.connect(this.worklet)
    // لا نوصل بالمخرج: التوصيل يعيد صوت المتحدث إلى سمّاعته
  }

  async stop(): Promise<void> {
    this.worklet?.port.close()
    this.worklet?.disconnect()
    this.worklet = null

    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null

    await this.context?.close()
    this.context = null
  }
}
