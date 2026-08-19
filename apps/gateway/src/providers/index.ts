import type { TranscriptionProvider } from '@arabic-v2t/core'
import { config } from '../config.js'
import { SpeechmaticsProvider } from './speechmatics.js'
import { MockProvider } from './mock.js'

/**
 * سجل المحركات.
 *
 * لإضافة محرك جديد (Google أو Whisper مثلًا): نفّذ واجهة `TranscriptionProvider`
 * في ملف بجوار هذا، وأضف حالته إلى `switch` أدناه. لا يتغيّر شيء آخر في المشروع —
 * الخادم والواجهة لا يعرفان أي محرك يعمل خلفهما.
 */
export function createProvider(): TranscriptionProvider {
  // بلا مفتاح API نعود إلى المحرك الوهمي بدل أن يفشل التشغيل،
  // فيبقى التطبيق قابلًا للتجربة كاملًا قبل إنشاء حساب Speechmatics.
  if (config.provider === 'speechmatics' && !config.speechmatics.apiKey) {
    console.warn(
      '⚠  SPEECHMATICS_API_KEY غير مضبوط — يعمل المحرك الوهمي (نص تجريبي، بلا تفريغ حقيقي).',
    )
    return new MockProvider()
  }

  switch (config.provider) {
    case 'speechmatics':
      return new SpeechmaticsProvider(config.speechmatics.apiKey, config.speechmatics.region)

    case 'google':
    case 'whisper':
      throw new Error(
        `محرك "${config.provider}" غير منفّذ بعد. نفّذ واجهة TranscriptionProvider في ` +
          `apps/gateway/src/providers/ وسجّله هنا.`,
      )
  }
}

export { SpeechmaticsProvider, MockProvider }
