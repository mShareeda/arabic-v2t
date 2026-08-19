import type { DialectDefinition } from '../types.js'
import { gulfBahraini } from './gulf-bh.js'
import { egyptian } from './egyptian.js'
import { modernStandardArabic } from './msa.js'
import { english } from './english.js'

/**
 * ┌──────────────────────────────────────────────────────────┐
 * │  سجل اللهجات — نقطة التوسّع الوحيدة في المشروع            │
 * │                                                          │
 * │  لإضافة لهجة جديدة:                                       │
 * │    ١. أنشئ ملفًا في هذا المجلد (انظر gulf-bh.ts كمثال)     │
 * │    ٢. استورده وأضفه إلى المصفوفة أدناه                     │
 * │                                                          │
 * │  لا شيء آخر. بطاقات الاختيار في الواجهة، وإعداد المحرك،    │
 * │  وقوائم التنظيف — كلها تُشتق من هنا تلقائيًا.              │
 * └──────────────────────────────────────────────────────────┘
 */
export const dialects: readonly DialectDefinition[] = [
  gulfBahraini,
  egyptian,
  modernStandardArabic,
  english,
]

/** فهرس سريع بالمُعرّف. يُبنى مرة واحدة عند تحميل الوحدة. */
const byId = new Map(dialects.map((d) => [d.id, d]))

// حارس يمنع تكرار المُعرّفات عند إضافة لهجة جديدة — يفشل عند التحميل لا وقت التشغيل.
if (byId.size !== dialects.length) {
  const seen = new Set<string>()
  const duplicate = dialects.find((d) => (seen.has(d.id) ? true : (seen.add(d.id), false)))
  throw new Error(`مُعرّف لهجة مكرر في السجل: ${duplicate?.id}`)
}

export function listDialects(): readonly DialectDefinition[] {
  return dialects
}

/** يعيد اللهجة أو `undefined` إن لم تكن مسجّلة. */
export function findDialect(id: string): DialectDefinition | undefined {
  return byId.get(id)
}

/** يعيد اللهجة أو يرمي خطأ — للاستعمال حين يكون المُعرّف مُتحقَّقًا منه مسبقًا. */
export function getDialect(id: string): DialectDefinition {
  const dialect = byId.get(id)
  if (!dialect) {
    throw new Error(`لهجة غير معروفة: "${id}". المتاح: ${[...byId.keys()].join('، ')}`)
  }
  return dialect
}

/** اللهجات مجمّعة حسب العائلة — لعرضها في أقسام داخل شاشة الاختيار. */
export function groupDialectsByFamily(): Map<string, DialectDefinition[]> {
  const groups = new Map<string, DialectDefinition[]>()
  for (const dialect of dialects) {
    const existing = groups.get(dialect.family)
    if (existing) existing.push(dialect)
    else groups.set(dialect.family, [dialect])
  }
  return groups
}

export { gulfBahraini, egyptian, modernStandardArabic, english }
