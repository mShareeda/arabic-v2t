import { redirect } from 'next/navigation'
import { findSummary } from '@/lib/dialect-summary'
import { getSessionUser } from '@/lib/auth/session'
import { Studio } from '@/components/studio'

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ dialect?: string }>
}) {
  const { dialect: dialectId } = await searchParams
  const dialect = findSummary(dialectId ?? null)

  // لهجة غير معروفة أو غائبة — نعيد المستخدم لشاشة الاختيار بدل عرض خطأ
  if (!dialect) redirect('/')

  // التسجيل متاح بلا حساب؛ الحساب يضيف حفظ التفريغ في السجل فقط
  const user = await getSessionUser()

  return <Studio dialect={dialect} isAuthenticated={user !== null} />
}
