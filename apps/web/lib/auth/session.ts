import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'sawt_session'
const SESSION_DAYS = 30

export interface SessionUser {
  id: string
  email: string
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    throw new Error('AUTH_SECRET غير مضبوط. ولّده بـ: openssl rand -base64 32')
  }
  return new TextEncoder().encode(secret)
}

/**
 * إنشاء جلسة وتخزينها في كوكي httpOnly.
 *
 * `httpOnly` يمنع قراءة الكوكي من JavaScript فلا تسرقها ثغرة XSS،
 * و`sameSite: lax` يمنع إرسالها مع الطلبات القادمة من مواقع أخرى (CSRF).
 */
export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .setAudience('session')
    .sign(secretKey())

  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** يعيد المستخدم الحالي أو null. لا يرمي — الاستدعاء شائع في مسارات عامة. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      audience: 'session',
      algorithms: ['HS256'],
    })

    if (!payload.sub || typeof payload.email !== 'string') return null
    return { id: payload.sub, email: payload.email }
  } catch {
    return null
  }
}

/**
 * تذكرة قصيرة العمر للدخول إلى الـ gateway.
 *
 * الـ gateway خدمة مستقلة قد تعمل على نطاق آخر فلا تصلها كوكيز الواجهة.
 * تُوقَّع بنفس السرّ المشترك بجمهور مختلف (`gateway` لا `session`)، فلا تصلح
 * تذكرة جلسة مسروقة للدخول إلى الـ gateway ولا العكس. عمرها خمس دقائق فقط:
 * تكفي لفتح الاتصال ولا تمنح وصولًا دائمًا إن تسرّبت في سجل خادم وسيط.
 */
export async function mintGatewayTicket(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience('gateway')
    .sign(secretKey())
}
