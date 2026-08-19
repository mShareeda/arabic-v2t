import { listDialects } from '@arabic-v2t/core'

/**
 * الشكل المسطّح للهجة، الصالح للعبور من مكوّن خادم إلى مكوّن عميل.
 *
 * `DialectDefinition` الكامل يحتوي كائنات `RegExp` (أنماط الحماية والتطبيع)،
 * وهي غير قابلة للتسلسل عبر حدود الخادم/العميل في Next.js. الواجهة لا تحتاجها
 * أصلًا — التنظيف كله يجري على الخادم.
 */
export interface DialectSummary {
  id: string
  label: string
  description: string
  sample: string
  family: string
  direction: 'rtl' | 'ltr'
  flag: string | null
}

export function getDialectSummaries(): DialectSummary[] {
  return listDialects().map((dialect) => ({
    id: dialect.id,
    label: dialect.label,
    description: dialect.description,
    sample: dialect.sample,
    family: dialect.family,
    direction: dialect.direction,
    flag: dialect.flag,
  }))
}

export function findSummary(id: string | null): DialectSummary | undefined {
  if (!id) return undefined
  return getDialectSummaries().find((dialect) => dialect.id === id)
}
