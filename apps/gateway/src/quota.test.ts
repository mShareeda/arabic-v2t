import { beforeEach, describe, expect, it } from 'vitest'
import { config } from './config.js'
import { beginSession, checkQuota, endSession, resetQuotas, sessionBudgetMs } from './quota.js'

describe('حصص الاستخدام', () => {
  beforeEach(() => resetQuotas())

  it('يسمح لمستخدم جديد', () => {
    expect(checkQuota('user-1').allowed).toBe(true)
  })

  it('يمنع بعد استهلاك الحصة الشهرية', () => {
    beginSession('user-1')
    endSession('user-1', config.limits.monthlyQuotaMs)

    const result = checkQuota('user-1')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('quota_exceeded')
  })

  it('يمنع تجاوز عدد الجلسات المتزامنة', () => {
    for (let i = 0; i < config.limits.maxConcurrentSessions; i++) beginSession('user-1')

    const result = checkQuota('user-1')
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('session_limit')
  })

  it('يحرّر الجلسة المتزامنة عند انتهائها', () => {
    for (let i = 0; i < config.limits.maxConcurrentSessions; i++) beginSession('user-1')
    endSession('user-1', 1000)
    expect(checkQuota('user-1').allowed).toBe(true)
  })

  it('يعزل المستخدمين عن بعضهم', () => {
    beginSession('user-1')
    endSession('user-1', config.limits.monthlyQuotaMs)
    expect(checkQuota('user-2').allowed).toBe(true)
  })

  it('ميزانية الجلسة لا تتجاوز المتبقي من الحصة الشهرية', () => {
    const remainingMs = 90_000
    beginSession('user-1')
    endSession('user-1', config.limits.monthlyQuotaMs - remainingMs)

    // حد الجلسة الواحدة أكبر من المتبقي، فالمتبقي هو الحاكم
    expect(sessionBudgetMs('user-1')).toBe(remainingMs)
  })

  it('ميزانية الجلسة محكومة بحد الجلسة الواحدة لمستخدم جديد', () => {
    expect(sessionBudgetMs('fresh-user')).toBe(
      Math.min(config.limits.maxSessionMs, config.limits.monthlyQuotaMs),
    )
  })

  it('لا يعطي ميزانية سالبة عند تجاوز الحصة', () => {
    beginSession('user-1')
    endSession('user-1', config.limits.monthlyQuotaMs * 2)
    expect(sessionBudgetMs('user-1')).toBe(0)
  })
})
