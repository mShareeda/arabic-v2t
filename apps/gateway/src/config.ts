import { config as loadEnv } from 'dotenv'
import { z } from 'zod'

loadEnv({ path: ['../../.env', '.env'], quiet: true })

const envSchema = z.object({
  STT_PROVIDER: z.enum(['speechmatics', 'google', 'whisper']).default('speechmatics'),
  SPEECHMATICS_API_KEY: z.string().default(''),
  SPEECHMATICS_REGION: z.string().default('eu2'),

  GATEWAY_PORT: z.coerce.number().int().positive().default(4000),
  GATEWAY_HOST: z.string().default('0.0.0.0'),
  AUTH_SECRET: z.string().default(''),

  MAX_SESSION_MINUTES: z.coerce.number().positive().default(15),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(50),
  MAX_UPLOAD_MINUTES: z.coerce.number().positive().default(30),
  USER_MONTHLY_QUOTA_MINUTES: z.coerce.number().positive().default(60),
  MAX_CONCURRENT_SESSIONS: z.coerce.number().int().positive().default(2),

  /** أصول مسموح لها بفتح اتصال — مفصولة بفواصل. */
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('إعدادات البيئة غير صالحة:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

const env = parsed.data

export const config = {
  provider: env.STT_PROVIDER,
  speechmatics: {
    apiKey: env.SPEECHMATICS_API_KEY,
    region: env.SPEECHMATICS_REGION,
  },
  server: {
    port: env.GATEWAY_PORT,
    host: env.GATEWAY_HOST,
    allowedOrigins: env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  authSecret: env.AUTH_SECRET,
  limits: {
    maxSessionMs: env.MAX_SESSION_MINUTES * 60_000,
    /** نُحذّر المستخدم قبل انتهاء المدة بدقيقتين. */
    warnBeforeMs: 2 * 60_000,
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    maxUploadMs: env.MAX_UPLOAD_MINUTES * 60_000,
    monthlyQuotaMs: env.USER_MONTHLY_QUOTA_MINUTES * 60_000,
    maxConcurrentSessions: env.MAX_CONCURRENT_SESSIONS,
  },
  isProduction: env.NODE_ENV === 'production',
} as const

export type Config = typeof config
