import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from './password'

describe('تجزئة كلمات المرور', () => {
  it('يقبل كلمة المرور الصحيحة', async () => {
    const stored = await hashPassword('correct-horse-battery')
    expect(await verifyPassword('correct-horse-battery', stored)).toBe(true)
  })

  it('يرفض كلمة المرور الخاطئة', async () => {
    const stored = await hashPassword('correct-horse-battery')
    expect(await verifyPassword('wrong-password', stored)).toBe(false)
  })

  it('ينتج تجزئة مختلفة لنفس الكلمة — ملح عشوائي لكل مستخدم', async () => {
    const first = await hashPassword('same-password')
    const second = await hashPassword('same-password')
    expect(first).not.toBe(second)
    expect(await verifyPassword('same-password', first)).toBe(true)
    expect(await verifyPassword('same-password', second)).toBe(true)
  })

  it('يتعامل مع المحارف العربية والرموز', async () => {
    const password = 'كلمة-سر-٢٠٢٦!@#'
    const stored = await hashPassword(password)
    expect(await verifyPassword(password, stored)).toBe(true)
  })

  it('يرفض التجزئة المشوّهة بدل أن ينهار', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false)
    expect(await verifyPassword('anything', '')).toBe(false)
    expect(await verifyPassword('anything', 'scrypt$abc')).toBe(false)
    expect(await verifyPassword('anything', 'bcrypt$aa$bb')).toBe(false)
  })

  it('يرفض تجزئة بطول خاطئ بدل رمي استثناء من timingSafeEqual', async () => {
    expect(await verifyPassword('anything', 'scrypt$aabb$ccdd')).toBe(false)
  })
})
