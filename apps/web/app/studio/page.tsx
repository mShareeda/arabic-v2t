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

  // التسجيل والرفع كلاهما يستهلكان دقائق مدفوعة، والحصة محسوبة على المستخدم،
  // فكلاهما يتطلب حسابًا. نعيد التوجيه هنا بدل ترك المستخدم يصطدم برفض
  // من الـ gateway بعد أن يكون قد منح إذن الميكروفون.
  const user = await getSessionUser()
  if (!user) redirect(`/login?next=/studio?dialect=${encodeURIComponent(dialect.id)}`)

  return <Studio dialect={dialect} />
}
