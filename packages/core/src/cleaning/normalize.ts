import type { DialectDefinition } from '../types.js'
import { DIACRITICS } from './boundaries.js'

const TATWEEL = /ـ/g

/** أرقام عربية-هندية (٠-٩) وفارسية (۰-۹) → أرقام غربية. */
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/g

function toWesternDigit(char: string): string {
  const code = char.codePointAt(0) ?? 0
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660)
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0)
  return char
}

/**
 * تطبيع النص العربي.
 *
 * قرار مقصود: **لا نوحّد الألف** (أ إ آ ← ا) رغم أنه تطبيع قياسي في البحث،
 * لأن مخرجنا نص يقرأه بشر لا فهرس بحث؛ وتوحيد الألف يفسد الإملاء الصحيح.
 * تصحيح الهمزات يتم عبر `replacements` الخاصة بكل لهجة بدلًا من ذلك.
 */
export function normalizeArabic(text: string, dialect?: DialectDefinition): string {
  let output = text
    // NFC أولًا: يدمج الهمزة المُركِّبة مع حرفها فتصير «ا + همزة فوق» حرف
    // «أ» واحدًا. بهذا يصل النص إلى بقية الخطوات بشكل واحد مهما كان مصدره،
    // وتتطابق المقارنات ومطابقة الأنماط بدل أن تفشل على شكل مكافئ بصريًا.
    .normalize('NFC')
    .replace(TATWEEL, '')
    .replace(DIACRITICS, '')
    .replace(ARABIC_INDIC_DIGITS, toWesternDigit)

  for (const replacement of dialect?.replacements ?? []) {
    output = output.replace(replacement.from, replacement.to)
  }

  return output
}
