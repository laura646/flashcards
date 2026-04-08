import type { Metadata } from 'next'
import { Lato } from 'next/font/google'
import './globals.css'
import Providers from '@/components/Providers'

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  display: 'swap',
  variable: '--font-lato',
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
    <html lang="en" className={lato.variable}>
      <body className="min-h-screen bg-gray-50">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
