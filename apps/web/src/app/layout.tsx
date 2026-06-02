import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chaika Team',
  description: 'Система сменных отчётов',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="font-sans" style={{ colorScheme: 'dark', fontFamily: 'var(--font-sans)' }}>
        {children}
      </body>
    </html>
  )
}
