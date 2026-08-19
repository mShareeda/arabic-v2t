'use client'

import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  const logout = async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className="text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
    >
      خروج
    </button>
  )
}
