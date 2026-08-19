import { jwtVerify } from 'jose'
import { config } from './config.js'

export interface AuthenticatedUser {
  readonly id: string
  readonly email: string | null
}

/**
 * التحقق من تذكرة الدخول إلى الـ gateway.
 *
 * لماذا تذكرة منفصلة عن جلسة الواجهة؟ لأن الـ gateway خدمة مستقلة قد تعمل على
 * نطاق آخر، فلا تصلها كوكيز الواجهة. الواجهة تصدر تذكرة قصيرة العمر موقّعة
 * بنفس السرّ المشترك (AUTH_SECRET)، والمتصفح يمرّرها في رابط الـ WebSocket.
 * التذكرة قصيرة العمر عمدًا: تسرّبها في سجل خادم وسيط لا يمنح وصولًا دائمًا.
 */
export async function verifyTicket(token: string | null): Promise<AuthenticatedUser | null> {
  // وضع التطوير: بلا سرّ مشترك لا توجد مصادقة أصلًا
  if (!config.authSecret) {
    if (config.isProduction) return null
    return { id: 'dev-user', email: null }
  }

  if (!token) return null

  try {
    const secret = new TextEncoder().encode(config.authSecret)
    const { payload } = await jwtVerify(token, secret, {
      audience: 'gateway',
      algorithms: ['HS256'],
    })

    if (!payload.sub) return null

    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    }
  } catch {
    return null
  }
}

/** يتحقق أن الأصل الطالب ضمن القائمة المسموح بها. */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!config.isProduction) return true
  if (!origin) return false
  return config.server.allowedOrigins.includes(origin)
}
