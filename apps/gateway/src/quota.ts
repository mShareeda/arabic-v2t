import { config } from './config.js'

/**
 * حصص الاستخدام — حماية النموذج الأولي من فاتورة مفاجئة.
 *
 * التخزين في الذاكرة حاليًا: يكفي نموذجًا أوليًا بخادم واحد، ويُفقد عند إعادة
 * التشغيل. المرحلة الرابعة تستبدله بجدول UsageRecord في قاعدة البيانات عبر
 * ربط `onUsageRecorded` أدناه — بلا تغيير في مواضع الاستدعاء.
 */

interface UserUsage {
  usedMs: number
  /** مفتاح الشهر (YYYY-MM) الذي يخصّه العدّاد — لتصفير تلقائي عند تغيّر الشهر. */
  periodKey: string
}

const usageByUser = new Map<string, UserUsage>()
const activeSessionsByUser = new Map<string, number>()

/** خطّاف يُستدعى عند تسجيل استهلاك — تربطه المرحلة الرابعة بقاعدة البيانات. */
export let onUsageRecorded: ((userId: string, durationMs: number) => void) | null = null

export function setUsageRecorder(recorder: (userId: string, durationMs: number) => void): void {
  onUsageRecorded = recorder
}

function currentPeriodKey(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function readUsage(userId: string): UserUsage {
  const period = currentPeriodKey()
  const existing = usageByUser.get(userId)
  if (!existing || existing.periodKey !== period) {
    const fresh: UserUsage = { usedMs: 0, periodKey: period }
    usageByUser.set(userId, fresh)
    return fresh
  }
  return existing
}

export interface QuotaCheck {
  readonly allowed: boolean
  readonly reason?: 'quota_exceeded' | 'session_limit'
  readonly remainingMs: number
}

export function checkQuota(userId: string): QuotaCheck {
  const usage = readUsage(userId)
  const remainingMs = config.limits.monthlyQuotaMs - usage.usedMs

  if (remainingMs <= 0) {
    return { allowed: false, reason: 'quota_exceeded', remainingMs: 0 }
  }

  const active = activeSessionsByUser.get(userId) ?? 0
  if (active >= config.limits.maxConcurrentSessions) {
    return { allowed: false, reason: 'session_limit', remainingMs }
  }

  return { allowed: true, remainingMs }
}

/**
 * أقصى مدة مسموحة لهذه الجلسة: الأقل بين حد الجلسة الواحدة والمتبقي من الحصة
 * الشهرية. بهذا لا تتجاوز جلسة واحدة ما تبقّى للمستخدم في الشهر.
 */
export function sessionBudgetMs(userId: string): number {
  const { remainingMs } = checkQuota(userId)
  return Math.min(config.limits.maxSessionMs, Math.max(0, remainingMs))
}

export function beginSession(userId: string): void {
  activeSessionsByUser.set(userId, (activeSessionsByUser.get(userId) ?? 0) + 1)
}

export function endSession(userId: string, durationMs: number): void {
  const active = activeSessionsByUser.get(userId) ?? 1
  if (active <= 1) activeSessionsByUser.delete(userId)
  else activeSessionsByUser.set(userId, active - 1)

  if (durationMs > 0) {
    readUsage(userId).usedMs += durationMs
    onUsageRecorded?.(userId, durationMs)
  }
}

/** للاختبارات فقط. */
export function resetQuotas(): void {
  usageByUser.clear()
  activeSessionsByUser.clear()
}
