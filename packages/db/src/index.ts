import { PrismaClient } from '@prisma/client'

/**
 * عميل Prisma مفرد.
 *
 * في وضع التطوير يعيد Next.js تحميل الوحدات مع كل تعديل، فلو أنشأنا عميلًا
 * جديدًا في كل مرة لاستنفدنا اتصالات قاعدة البيانات خلال دقائق. نخزّنه على
 * `globalThis` لينجو من إعادة التحميل.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export { PrismaClient } from '@prisma/client'
export type { User, Transcript, UsageRecord, TranscriptSource } from '@prisma/client'
