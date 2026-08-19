import { redirect } from 'next/navigation'
import { findSummary } from '@/lib/dialect-summary'
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

  return <Studio dialect={dialect} />
}
