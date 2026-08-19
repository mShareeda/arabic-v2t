import { describe, expect, it } from 'vitest'
import { findDialect, getDialect, groupDialectsByFamily, listDialects } from './index.js'

describe('سجل اللهجات', () => {
  it('يسجّل لهجات النسخة الأولى الأربع', () => {
    const ids = listDialects().map((d) => d.id)
    expect(ids).toEqual(expect.arrayContaining(['ar-BH', 'ar-EG', 'ar-MSA', 'en-US']))
  })

  it('يعيد لهجة بمُعرّفها', () => {
    expect(getDialect('ar-EG').label).toBe('المصرية')
  })

  it('يرمي خطأ واضحًا للهجة غير معروفة', () => {
    expect(() => getDialect('ar-ZZ')).toThrow(/لهجة غير معروفة/)
  })

  it('يعيد undefined بدل الرمي عند استخدام findDialect', () => {
    expect(findDialect('ar-ZZ')).toBeUndefined()
  })

  it('يجمّع اللهجات حسب العائلة', () => {
    const groups = groupDialectsByFamily()
    expect(groups.get('gulf')?.map((d) => d.id)).toEqual(['ar-BH'])
    expect(groups.get('english')?.map((d) => d.id)).toEqual(['en-US'])
  })
})

describe('سلامة تعريفات اللهجات', () => {
  const dialects = listDialects()

  it('كل المُعرّفات فريدة', () => {
    const ids = dialects.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  for (const dialect of dialects) {
    describe(dialect.id, () => {
      it('يحمل الحقول المعروضة في الواجهة', () => {
        expect(dialect.label.length).toBeGreaterThan(0)
        expect(dialect.description.length).toBeGreaterThan(0)
        expect(dialect.sample.length).toBeGreaterThan(0)
      })

      it('يُنتج إعدادًا صالحًا لكل المزوّدين الثلاثة', () => {
        expect(dialect.engine.speechmatics.language).toMatch(/^[a-z]{2}$/)
        expect(['standard', 'enhanced']).toContain(dialect.engine.speechmatics.operatingPoint)
        expect(dialect.engine.speechmatics.maxDelay).toBeGreaterThan(0)
        expect(dialect.engine.google.languageCode).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
        expect(dialect.engine.whisper.language).toMatch(/^[a-z]{2}$/)
      })

      it('اتجاه الكتابة يطابق عائلة اللهجة', () => {
        const expected = dialect.family === 'english' ? 'ltr' : 'rtl'
        expect(dialect.direction).toBe(expected)
      })

      it('كل كلمة محمية مذكورة في قائمة الحشو — وإلا فالحماية بلا أثر', () => {
        for (const protectedWord of dialect.protectedWords ?? []) {
          expect(dialect.fillers).toContain(protectedWord.word)
        }
      })

      it('أنماط الحماية تحمل علم g حتى تُفحص كل المواضع', () => {
        for (const protectedWord of dialect.protectedWords ?? []) {
          expect(protectedWord.keepWhen.flags).toContain('g')
        }
      })

      it('لا تكرار في قائمة كلمات الحشو', () => {
        expect(new Set(dialect.fillers).size).toBe(dialect.fillers.length)
      })
    })
  }
})
