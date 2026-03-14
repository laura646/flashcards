import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Flashcards | English with Laura',
  description: 'Practice vocabulary from your English lessons',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
