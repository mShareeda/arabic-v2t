import { getDialectSummaries } from '@/lib/dialect-summary'
import { WelcomeFlow } from '@/components/welcome-flow'
import { SiteNav } from '@/components/site-nav'

export default function HomePage() {
  const dialects = getDialectSummaries()

  return (
    <main className="mx-auto min-h-dvh max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
      <SiteNav />

      {/* ترويسة تحريرية: خط شعري، ترقيم أقسام، بلا شعار ولا أيقونة مساعد */}
      <header className="mt-8 border-b border-[var(--color-ink)] pb-6">
        <p className="eyebrow">تفريغ صوتي باللهجات العربية</p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">صوت</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--color-ink-muted)] sm:text-xl">
          يحول كلامك إلى نص مكتوب أثناء نطقه، باللهجة التي تتحدث بها فعلا — لا بالفصحى المترجمة.
          ويحذف كلمات الحشو والتلعثم تلقائيا.
        </p>
      </header>

      <div className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-[auto_1fr] sm:gap-14">
        <div className="hidden sm:block">
          <span className="section-index">01</span>
        </div>

        <WelcomeFlow dialects={dialects} />
      </div>

      <footer className="mt-20 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--color-rule)] pt-6 text-xs text-[var(--color-ink-faint)]">
        <span>الصوت يعالج ولا يخزن إلا بطلبك</span>
        <span>·</span>
        <span>يعمل على الجوال والحاسوب</span>
      </footer>
    </main>
  )
}
