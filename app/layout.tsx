import type { Metadata } from 'next'
import { Rubik } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

// Phase A of the student-app visual redesign — Rubik replaces Lato as
// the global typeface. Loaded with the full weight range the brief
// calls for (400-900) so headings, eyebrows and the 40/900 word
// rendering all have proper weights available.
const rubik = Rubik({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-rubik',
})

export const metadata: Metadata = {
  title: 'English with Laura',
  description: 'English with Laura Learning Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={rubik.variable}>
      <body className="min-h-screen bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
