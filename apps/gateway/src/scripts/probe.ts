/**
 * مسبار الجلسة الحية.
 *
 * يفتح اتصالًا بالـ gateway ويدفع صوتًا اصطناعيًا، ويطبع **الزمن حتى أول نص**
 * — وهو المتطلب الأساسي في المشروع: أن يبدأ النص بالظهور فور بدء الكلام لا
 * بعد انتهاء التسجيل. يعمل بلا ميكروفون وبلا متصفح.
 *
 *   pnpm --filter @arabic-v2t/gateway probe [dialectId]
 */
import WebSocket from 'ws'

const dialectId = process.argv[2] ?? 'ar-BH'
const gatewayUrl = process.env.GATEWAY_URL ?? 'ws://localhost:4000'
const ticket = process.env.GATEWAY_TICKET ?? ''
const SAMPLE_RATE = 16_000
const FRAME_MS = 100

const url = ticket ? `${gatewayUrl}/live?ticket=${ticket}` : `${gatewayUrl}/live`
const socket = new WebSocket(url, { headers: { origin: 'http://localhost:3000' } })

let startedAt = 0
let firstTextAt: number | null = null
let segmentCount = 0
let audioTimer: NodeJS.Timeout | null = null

/** يولّد إطار صوت صامت بصيغة PCM 16-bit little-endian. */
function silenceFrame(): Uint8Array {
  const samples = (SAMPLE_RATE * FRAME_MS) / 1000
  return new Uint8Array(samples * 2)
}

function reportFirstText(label: string, text: string): void {
  if (firstTextAt === null) {
    firstTextAt = Date.now() - startedAt
    console.log(`\n⏱  الزمن حتى أول نص: ${firstTextAt}ms  (${label})`)
  }
  console.log(`   ${label}: ${text}`)
}

socket.on('open', () => {
  console.log(`متصل بـ ${gatewayUrl} — اللهجة: ${dialectId}`)
  socket.send(JSON.stringify({ type: 'start', dialectId, sampleRate: SAMPLE_RATE }))
})

socket.on('message', (data) => {
  const message = JSON.parse(data.toString()) as {
    type: string
    text?: string
    segment?: { clean: string; raw: string }
    message?: string
    durationMs?: number
  }

  switch (message.type) {
    case 'ready':
      console.log('الجلسة جاهزة — بدء دفع الصوت')
      startedAt = Date.now()
      audioTimer = setInterval(() => socket.send(silenceFrame()), FRAME_MS)
      // ننهي بعد 12 ثانية، وهو ما يكفي لعدة مقاطع
      setTimeout(() => socket.send(JSON.stringify({ type: 'stop' })), 12_000)
      break

    case 'partial':
      if (message.text?.trim()) reportFirstText('جزئي', message.text)
      break

    case 'segment':
      segmentCount += 1
      reportFirstText('نهائي', message.segment?.clean ?? '')
      console.log(`     خام:   ${message.segment?.raw ?? ''}`)
      break

    case 'warning':
      console.log('تحذير: اقتراب حد الجلسة')
      break

    case 'error':
      console.error(`خطأ [${(message as { code?: string }).code}]: ${message.message}`)
      break

    case 'done':
      console.log(`\nانتهت الجلسة — المدة ${message.durationMs}ms، المقاطع ${segmentCount}`)
      if (firstTextAt === null) console.error('لم يصل أي نص — تحقّق من إعداد المحرك')
      else if (firstTextAt > 2000) console.warn(`تحذير: أول نص تأخّر ${firstTextAt}ms (الهدف < 2000ms)`)
      else console.log('✓ أول نص ظهر ضمن الهدف (أقل من ثانيتين)')
      socket.close()
      break
  }
})

socket.on('close', () => {
  if (audioTimer) clearInterval(audioTimer)
  process.exit(firstTextAt === null ? 1 : 0)
})

socket.on('error', (error) => {
  console.error('تعذّر الاتصال:', error.message)
  process.exit(1)
})
