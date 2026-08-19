'use client'

import { useEffect, useRef } from 'react'

const BAR_COUNT = 48

interface AmplitudeMeterProps {
  /** ذروة السعة الأخيرة (0 إلى 1). */
  peak: number
  active: boolean
}

/**
 * مؤشر التسجيل: أعمدة سعة أفقية رفيعة تنزلق يمينًا مع الزمن.
 *
 * قرار تصميمي مقصود: **ليست كرة نابضة**. الكرة النابضة صارت العلامة البصرية
 * النمطية لتطبيقات الذكاء الاصطناعي، والمطلوب هنا ابتعاد عنها. الأعمدة تشبه
 * مخطط موجة في برنامج تحرير صوتي — لغة أدوات، لا لغة مساعد افتراضي.
 */
export function AmplitudeMeter({ peak, active }: AmplitudeMeterProps) {
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0))
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) {
      barsRef.current = new Array(BAR_COUNT).fill(0)
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    // إزاحة السجل عمودًا واحدًا وإضافة الذروة الجديدة في المقدمة
    barsRef.current = [...barsRef.current.slice(1), peak]
  }, [peak, active])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    let frameId = 0

    const draw = (): void => {
      const dpr = window.devicePixelRatio || 1
      const width = canvas.clientWidth
      const height = canvas.clientHeight

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)

      const styles = getComputedStyle(document.documentElement)
      const brass = styles.getPropertyValue('--color-brass').trim() || '#c8892a'
      const rule = styles.getPropertyValue('--color-rule').trim() || '#d6cfc0'

      // في السكون: خط شعري واحد لا 48 عمودًا بارتفاع 2px — الأعمدة الساكنة
      // تُقرأ كخط متقطّع زخرفي، وهو ضجيج بصري في صفحة مليئة بالخطوط أصلًا
      if (!active) {
        context.fillStyle = rule
        context.fillRect(0, height / 2 - 0.5, width, 1)
        frameId = requestAnimationFrame(draw)
        return
      }

      const gap = 3
      const barWidth = Math.max(1, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT)

      barsRef.current.forEach((value, index) => {
        // جذر تربيعي يوسّع المدى المسموع — الكلام العادي يقع في نطاق ضيق
        const magnitude = Math.sqrt(Math.min(1, Math.max(0, value)))
        const barHeight = Math.max(2, magnitude * height)
        const x = index * (barWidth + gap)
        const y = (height - barHeight) / 2

        context.fillStyle = magnitude > 0.02 ? brass : rule
        context.fillRect(x, y, barWidth, barHeight)
      })

      frameId = requestAnimationFrame(draw)
    }

    frameId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameId)
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="h-12 w-full"
      style={{ direction: 'ltr' }}
    />
  )
}
