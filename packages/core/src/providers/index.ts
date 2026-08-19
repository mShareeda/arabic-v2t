/**
 * الواجهة فقط — بلا تنفيذ.
 *
 * تنفيذات المحركات تعيش في `apps/gateway/src/providers/` لأنها تحتاج
 * WebSocket ونظام ملفات، وهما غير متاحين في المتصفح. إبقاء هذه الحزمة
 * نقية يعني أن الواجهة تستطيع استيراد الأنواع وسجل اللهجات دون أن يُسحب
 * معها أي كود خادم إلى حزمة المتصفح.
 *
 * لإضافة محرك جديد: نفّذ `TranscriptionProvider` في مجلد الـ gateway
 * وسجّله في `apps/gateway/src/providers/index.ts`.
 */
export type {
  ProviderId,
  StreamHandlers,
  StreamSession,
  StreamOptions,
  FileTranscriptionOptions,
  TranscriptionProvider,
} from './types.js'
export { ProviderError } from './types.js'
