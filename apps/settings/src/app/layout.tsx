import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LLucy Settings',
  description: 'Gestisci il tuo account LLucy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className="antialiased min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {children}
        </div>
      </body>
    </html>
  )
}
