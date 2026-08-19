import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth-form'
import { getSessionUser } from '@/lib/auth/session'

export default async function LoginPage() {
  if (await getSessionUser()) redirect('/')

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12 sm:px-8">
      <header className="mb-8 border-b border-[var(--color-ink)] pb-5">
        <p className="eyebrow">صَوت</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">تسجيل الدخول</h1>
      </header>
      <AuthForm mode="login" />
    </main>
  )
}
