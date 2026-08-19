import type { DialectDefinition } from '../types.js'
import { wordRegex } from '../cleaning/boundaries.js'

/**
 * العربية الفصحى الحديثة (MSA).
 *
 * تأخير أقصر (1.2 ثانية) لأن الفصحى أوضح نطقًا وأقل حاجة لسياق لاحق
 * لتثبيت الجملة، فتظهر أسرع على الشاشة.
 */
export const modernStandardArabic: DialectDefinition = {
  id: 'ar-MSA',
  label: 'العربية الفصحى',
  description: 'الفصحى الحديثة — المحتوى الرسمي والإعلامي والمحاضرات',
  sample: 'كيف حالك؟ نبدأ الآن بعرض الموضوع.',
  family: 'msa',
  direction: 'rtl',
  flag: null,

  engine: {
    speechmatics: {
      language: 'ar',
      operatingPoint: 'enhanced',
      maxDelay: 1.2,
      enableCodeSwitching: false,
      additionalVocab: [],
    },
    google: {
      languageCode: 'ar-XA',
      model: 'chirp_3',
    },
    whisper: {
      language: 'ar',
      initialPrompt: 'نص باللغة العربية الفصحى الحديثة، بأسلوب رسمي ومنقّح.',
    },
  },

  fillers: ['أه', 'آه', 'اه', 'امم', 'أمم', 'ممم', 'همم', 'ااا'],

  protectedWords: [],

  replacements: [
    { from: wordRegex('انا'), to: 'أنا', note: 'همزة القطع في ضمير المتكلم' },
    { from: wordRegex('الذى'), to: 'الذي', note: 'تصحيح الياء المهملة' },
    { from: wordRegex('على ان'), to: 'على أن', note: 'همزة القطع في «أن»' },
    { from: wordRegex('اذا'), to: 'إذا', note: 'همزة القطع في «إذا»' },
  ],
}
