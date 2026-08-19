import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * تجزئة كلمة المرور بـ scrypt.
 *
 * scrypt مدمج في Node ومصمَّم أصلًا لكلمات المرور (بطيء ومكلف في الذاكرة عمدًا،
 * فيقاوم الكسر بالعتاد المتخصّص). استخدامه يعني صفر اعتماديات خارجية لأخطر
 * جزء في النظام — لا مكتبة تشفير قد تُهجر أو تحتاج بناءً أصليًا.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

/**
 * التحقق من كلمة المرور.
 *
 * المقارنة بـ `timingSafeEqual` لا بـ `===`: المقارنة العادية تتوقف عند أول
 * بايت مختلف، فيتسرّب من زمن التنفيذ عدد البايتات الصحيحة.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false

  const expected = Buffer.from(hashHex, 'hex')
  if (expected.length !== KEY_LENGTH) return false

  const derived = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH)
  return timingSafeEqual(derived, expected)
}
