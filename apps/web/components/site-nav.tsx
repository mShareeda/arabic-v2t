import Link from 'next/link'
import { getSessionUser } from '@/lib/auth/session'
import { LogoutButton } from './logout-button'

/** شريط تنقّل صغير — نص فقط بلا شعار ولا أيقونات، اتساقًا مع اللغة التحريرية. */
export async function SiteNav() {
  const user = await getSessionUser()

  return (
    <nav className="flex items-center justify-end gap-5 text-sm">
      {user ? (
        <>
          <Link href="/library" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            سجل التفريغات
          </Link>
          <span className="font-mono text-xs text-[var(--color-ink-faint)]" dir="ltr">
            {user.email}
          </span>
          <LogoutButton />
        </>
      ) : (
        <>
          <Link href="/login" className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            دخول
          </Link>
          <Link href="/register" className="text-[var(--color-brass)] underline">
            حساب جديد
          </Link>
        </>
      )}
    </nav>
  )
}
