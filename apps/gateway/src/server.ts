import { WebSocketServer } from 'ws'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { listDialects } from '@arabic-v2t/core'
import { config } from './config.js'
import { isOriginAllowed, verifyTicket } from './auth.js'
import { createProvider } from './providers/index.js'
import { LiveSession } from './session.js'
import { registerUploadRoute } from './upload.js'

const provider = createProvider()

const app = Fastify({
  logger: { level: config.isProduction ? 'info' : 'debug' },
  bodyLimit: config.limits.maxUploadBytes,
})

await app.register(cors, {
  origin: config.isProduction ? config.server.allowedOrigins : true,
  credentials: true,
})

app.get('/health', async () => ({
  status: 'ok',
  provider: provider.id,
  streaming: provider.supportsStreaming,
  dialects: listDialects().length,
}))

/** سجل اللهجات — الواجهة تبني بطاقات الاختيار منه. */
app.get('/dialects', async () => ({
  dialects: listDialects().map((dialect) => ({
    id: dialect.id,
    label: dialect.label,
    description: dialect.description,
    sample: dialect.sample,
    family: dialect.family,
    direction: dialect.direction,
    flag: dialect.flag,
  })),
}))

registerUploadRoute(app, provider)

// ── ترقية HTTP إلى WebSocket ───────────────────────────────────
// `noServer` مقصود: نتولّى الترقية بأنفسنا ليمرّ كل اتصال بفحص الأصل
// والتذكرة قبل أن يُنشأ له socket أصلًا، بدل رفضه بعد الفتح.
const wss = new WebSocketServer({ noServer: true })

app.server.on('upgrade', (request, socket, head) => {
  void (async () => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

    if (url.pathname !== '/live') {
      socket.destroy()
      return
    }

    if (!isOriginAllowed(request.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
      socket.destroy()
      return
    }

    const user = await verifyTicket(url.searchParams.get('ticket'))
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      app.log.info({ userId: user.id }, 'جلسة تفريغ حية جديدة')
      // المرحلة الرابعة تمرّر دالة الحفظ في قاعدة البيانات بدل null
      new LiveSession(ws, user, provider, null)
    })
  })()
})

await app.listen({ port: config.server.port, host: config.server.host })

app.log.info(`المحرك النشط: ${provider.id}`)
if (!config.authSecret && !config.isProduction) {
  app.log.warn('⚠  AUTH_SECRET غير مضبوط — المصادقة معطّلة (وضع التطوير فقط).')
}

const shutdown = (): void => {
  app.log.info('إيقاف الـ gateway…')
  for (const client of wss.clients) client.close()
  void app.close().then(() => process.exit(0))
  setTimeout(() => process.exit(1), 5_000).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
