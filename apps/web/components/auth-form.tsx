'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface AuthFormProps {
  mode: 'login' | 'register'
}

const COPY = {
  login: {
    title: 'تسجيل الدخول',
    submit: 'دخول',
    switchText: 'ليس لديك حساب؟',
    switchLink: 'أنشئ حسابًا',
    switchHref: '/register',
    endpoint: '/api/auth/login',
  },
  register: {
    title: 'حساب جديد',
    submit: 'إنشاء الحساب',
    switchText: 'لديك حساب بالفعل؟',
    switchLink: 'سجّل الدخول',
    switchHref: '/login',
    endpoint: '/api/auth/register',
  },
} as const

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const copy = COPY[mode]

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      const response = await fetch(copy.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? 'تعذّر إتمام الطلب')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('تعذّر الاتصال بالخادم')
    } finally {
      setPending(false)
    }
  }

  const fieldClass =
    'w-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-4 py-3 outline-none focus:border-[var(--color-brass)]'

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="eyebrow">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          dir="ltr"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="eyebrow">
          كلمة المرور
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={mode === 'register' ? 8 : undefined}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          dir="ltr"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className={fieldClass}
        />
        {mode === 'register' ? (
          <span className="text-xs text-[var(--color-ink-faint)]">8 محارف على الأقل</span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="border-s-2 border-[var(--color-coral)] px-4 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-[var(--color-ink)] px-7 py-3.5 text-[var(--color-paper)] transition-opacity hover:opacity-90 disabled:opacity-40"
        style={{ borderRadius: 'var(--radius-sharp)' }}
      >
        {pending ? '…' : copy.submit}
      </button>

      <p className="text-sm text-[var(--color-ink-muted)]">
        {copy.switchText}{' '}
        <Link href={copy.switchHref} className="text-[var(--color-brass)] underline">
          {copy.switchLink}
        </Link>
      </p>
    </form>
  )
}
