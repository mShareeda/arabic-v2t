/**
 * معالج التقاط الصوت — يعمل في خيط الصوت المنفصل.
 *
 * لماذا AudioWorklet وليس ScriptProcessorNode؟ لأن الأخير مهجور، ويعمل على
 * الخيط الرئيسي فيتقطّع الصوت كلما انشغلت الواجهة بإعادة الرسم — وواجهتنا
 * تعيد الرسم مع كل كلمة تصل.
 *
 * يجمّع العيّنات في إطارات بطول 100ms بدل بثّها كل 128 عيّنة (~2.6ms)،
 * فعدد الرسائل عبر الشبكة يقلّ نحو 40 ضعفًا بلا زيادة محسوسة في التأخير.
 */

const FRAME_MS = 100

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.frameSize = Math.round((sampleRate * FRAME_MS) / 1000)
    this.buffer = new Float32Array(this.frameSize)
    this.offset = 0
  }

  process(inputs) {
    const channel = inputs[0]?.[0]
    if (!channel) return true

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset] = channel[i]
      this.offset += 1

      if (this.offset === this.frameSize) {
        const frame = this.toPCM16(this.buffer)
        // ننقل ملكية المخزن بدل نسخه — لا نسخة زائدة لكل إطار
        this.port.postMessage(frame, [frame.pcm])
        this.offset = 0
      }
    }

    return true
  }

  /** تحويل عيّنات الفاصلة العائمة إلى PCM 16-bit little-endian. */
  toPCM16(samples) {
    const output = new Int16Array(samples.length)
    let peak = 0

    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]))
      output[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
      const magnitude = Math.abs(clamped)
      if (magnitude > peak) peak = magnitude
    }

    // نمرّر ذروة السعة مع الإطار ليرسم مؤشر التسجيل بلا تحليل إضافي
    return { pcm: output.buffer, peak }
  }
}

registerProcessor('pcm-processor', PCMProcessor)
