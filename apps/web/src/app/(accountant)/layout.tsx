import Link from 'next/link'
import { logoutAction } from '@/app/(auth)/login/actions'

export default function AccountantLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav
        className="sticky top-0 z-sticky h-14 px-4 flex items-center justify-between border-b border-border"
        style={{ backgroundColor: 'oklch(15% 0.010 260 / 80%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        {/* Left: logo + nav links */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold shrink-0"
              style={{
                background: 'var(--color-accent-subtle)',
                border: '1px solid var(--color-accent-border)',
                color: 'var(--color-accent)',
              }}
            >
              CT
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Chaika Team
            </span>
          </div>

          <span style={{ color: 'var(--color-border)' }} aria-hidden="true">·</span>

          <Link
            href="/expenses"
            className="text-sm transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Расходы
          </Link>
          <Link
            href="/expense-report"
            className="text-sm transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Отчёт
          </Link>
        </div>

        {/* Right: logout */}
        <form action={logoutAction}>
          <button type="submit" className="btn btn-ghost btn--sm">
            Выйти
          </button>
        </form>
      </nav>
      {children}
    </>
  )
}
