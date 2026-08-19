import type { DialectDefinition } from '../types.js'

/**
 * الإنجليزية.
 *
 * لم تُدرج «like» و«you know» و«actually» في كلمات الحشو رغم شيوعها كذلك،
 * لأنها كلمات أصيلة تتكرر في الكلام العادي، وحذفها يفسد المعنى أكثر مما ينظّفه.
 * القاعدة العامة في هذا المشروع: لا نحذف إلا ما لا يحمل معنى إطلاقًا.
 */
export const english: DialectDefinition = {
  id: 'en-US',
  label: 'English',
  description: 'English — with Arabic code-switching support',
  sample: 'How are you doing today?',
  family: 'english',
  direction: 'ltr',
  flag: '🇺🇸',

  engine: {
    speechmatics: {
      language: 'en',
      operatingPoint: 'enhanced',
      maxDelay: 1.2,
      enableCodeSwitching: true,
      additionalVocab: [],
    },
    google: {
      languageCode: 'en-US',
      model: 'chirp_3',
      alternativeLanguageCodes: ['ar-XA'],
    },
    whisper: {
      language: 'en',
    },
  },

  fillers: ['um', 'umm', 'ummm', 'uh', 'uhh', 'uhm', 'hmm', 'hm', 'mmm', 'er', 'erm', 'ah', 'eh'],

  protectedWords: [
    {
      word: 'ah',
      keepWhen: /\bah\s+(?:yes|no|right|ok|okay)\b/gi,
      note: 'ah as a genuine interjection carrying meaning',
    },
  ],

  replacements: [],
}
