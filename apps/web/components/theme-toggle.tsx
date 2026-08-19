'use client'

import { useEffect, useState } from 'react'

type Theme = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'sawt-theme'

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<Theme, string> = { system: 'تلقائي', light: 'فاتح', dark: 'داكن' }

/**
 * مبدّل السمة بثلاث حالات: تلقائي (حسب النظام)، فاتح، داكن.
 *
 * الحالة «تلقائي» تحذف السمة من عنصر الجذر بدل تثبيت قيمة، فتعود قواعد
 * `prefers-color-scheme` في ملف الأنماط هي الحاكمة.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') setTheme(stored)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme')
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      document.documentElement.setAttribute('data-theme', theme)
      window.localStorage.setItem(STORAGE_KEY, theme)
    }
  }, [theme, mounted])

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`السمة: ${LABEL[theme]} — اضغط للتبديل`}
      className="font-mono text-xs text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"
    >
      {/* حتى يكتمل التركيب لا نعرف اختيار المستخدم المخزّن، فنعرض نصًا محايدًا
          بدل قيمة خاطئة تومض ثم تتغيّر */}
      {mounted ? LABEL[theme] : '—'}
    </button>
  )
}
