import type { Metadata, Viewport } from 'next'
import { alexandria } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'صوت — تفريغ صوتي باللهجات العربية',
  description:
    'تفريغ صوتي حي باللهجات العربية: الخليجية، المصرية، الفصحى، والإنجليزية — مع تنظيف تلقائي لكلمات الحشو.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f1ea' },
    { media: '(prefers-color-scheme: dark)', color: '#12100e' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={alexandria.variable}>
      <body>{children}</body>
    </html>
  )
}
