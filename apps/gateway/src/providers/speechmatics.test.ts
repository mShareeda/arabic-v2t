import { describe, expect, it } from 'vitest'
import { resultsToWords } from './speechmatics.js'

describe('resultsToWords', () => {
  it('يحوّل الكلمات مع طوابعها الزمنية بالمللي ثانية', () => {
    const words = resultsToWords([
      { type: 'word', start_time: 0.1, end_time: 0.45, alternatives: [{ content: 'مرحبا' }] },
    ])
    expect(words).toEqual([{ text: 'مرحبا', startMs: 100, endMs: 450 }])
  })

  it('يلصق علامة الترقيم بالكلمة السابقة بدل جعلها كلمة مستقلة', () => {
    const words = resultsToWords([
      { type: 'word', start_time: 0, end_time: 0.4, alternatives: [{ content: 'مرحبا' }] },
      {
        type: 'punctuation',
        start_time: 0.4,
        end_time: 0.5,
        attaches_to: 'previous',
        alternatives: [{ content: '،' }],
      },
      { type: 'word', start_time: 0.6, end_time: 1, alternatives: [{ content: 'أهلا' }] },
    ])
    expect(words.map((w) => w.text)).toEqual(['مرحبا،', 'أهلا'])
    expect(words[0]?.endMs).toBe(500)
  })

  it('يُبقي علامة ترقيم في بداية النص ككيان مستقل — لا كلمة قبلها لتلتصق بها', () => {
    const words = resultsToWords([
      {
        type: 'punctuation',
        start_time: 0,
        end_time: 0.1,
        attaches_to: 'previous',
        alternatives: [{ content: '،' }],
      },
    ])
    expect(words.map((w) => w.text)).toEqual(['،'])
  })

  it('يتجاهل النتائج بلا محتوى', () => {
    const words = resultsToWords([
      { type: 'word', start_time: 0, end_time: 0.4, alternatives: [] },
      { type: 'speaker_change', start_time: 0.4, end_time: 0.4 },
    ])
    expect(words).toEqual([])
  })

  it('ينقل درجة الثقة حين يوفّرها المحرك', () => {
    const words = resultsToWords([
      {
        type: 'word',
        start_time: 0,
        end_time: 0.4,
        alternatives: [{ content: 'مرحبا', confidence: 0.87 }],
      },
    ])
    expect(words[0]?.confidence).toBe(0.87)
  })
})
