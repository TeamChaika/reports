import Link from 'next/link'
import { logoutAction } from '@/app/(auth)/login/actions'

export default function AccountantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Shift Reports · Бухгалтерия
          </span>
          <Link
            href="/expenses"
            className="text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Расходы
          </Link>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Выйти
          </button>
        </form>
      </nav>
      {children}
    </>
  )
}
