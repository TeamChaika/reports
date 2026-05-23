import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Shift Reports',
  description: 'Система сменных отчётов',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className="font-sans" style={{ colorScheme: 'dark', fontFamily: 'var(--font-sans)' }}>
        {children}
      </body>
    </html>
  )
}
