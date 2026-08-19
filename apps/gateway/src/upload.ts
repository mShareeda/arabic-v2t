import type { FastifyInstance } from 'fastify'
import { cleanTranscript, findDialect, type TranscriptionProvider } from '@arabic-v2t/core'
import { config } from './config.js'
import { verifyTicket } from './auth.js'
import { checkQuota, endSession, beginSession } from './quota.js'

/**
 * التفريغ الدفعي: رفع ملف صوتي جاهز.
 *
 * يعيش في الـ gateway لا في الواجهة، لأن مفتاح المحرك يجب أن يبقى في مكان
 * واحد؛ ولأن الملفات الطويلة تحتاج طلبًا يتجاوز مهلة دالة serverless.
 */
export function registerUploadRoute(app: FastifyInstance, provider: TranscriptionProvider): void {
  app.post('/upload', async (request, reply) => {
    const ticket =
      request.headers.authorization?.replace(/^Bearer\s+/i, '') ??
      (request.query as { ticket?: string }).ticket ??
      null

    const user = await verifyTicket(ticket)
    if (!user) {
      return reply.code(401).send({ error: 'غير مصرّح' })
    }

    const quota = checkQuota(user.id)
    if (!quota.allowed) {
      return reply.code(429).send({
        error:
          quota.reason === 'session_limit'
            ? 'تجاوزت عدد المهام المتزامنة'
            : 'انتهت حصتك الشهرية من دقائق التفريغ',
        code: quota.reason,
      })
    }

    const body = request.body as
      { dialectId?: string; fileName?: string; audioBase64?: string } | undefined

    const dialectId = body?.dialectId
    const audioBase64 = body?.audioBase64

    if (!dialectId || !audioBase64) {
      return reply.code(400).send({ error: 'الحقول dialectId و audioBase64 مطلوبة' })
    }

    const dialect = findDialect(dialectId)
    if (!dialect) {
      return reply.code(400).send({ error: `لهجة غير معروفة: ${dialectId}` })
    }

    const audio = Buffer.from(audioBase64, 'base64')
    if (audio.byteLength === 0) {
      return reply.code(400).send({ error: 'الملف الصوتي فارغ' })
    }
    if (audio.byteLength > config.limits.maxUploadBytes) {
      return reply.code(413).send({
        error: `حجم الملف يتجاوز الحد المسموح (${Math.round(config.limits.maxUploadBytes / 1024 / 1024)}MB)`,
      })
    }

    beginSession(user.id)
    try {
      const raw = await provider.transcribeFile({
        dialect,
        audio: new Uint8Array(audio),
        fileName: body?.fileName ?? 'audio',
      })

      const cleaned = cleanTranscript(raw, dialect)
      endSession(user.id, cleaned.durationMs)

      return {
        dialectId: dialect.id,
        durationMs: cleaned.durationMs,
        segments: cleaned.segments,
        rawText: cleaned.rawText,
        cleanText: cleaned.cleanText,
        removedCount: cleaned.removedCount,
      }
    } catch (error) {
      endSession(user.id, 0)
      request.log.error({ err: error }, 'فشل التفريغ الدفعي')
      return reply.code(502).send({
        error: error instanceof Error ? error.message : 'فشل التفريغ',
      })
    }
  })
}
