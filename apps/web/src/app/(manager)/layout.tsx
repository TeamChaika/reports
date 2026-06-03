import Link from 'next/link'
import { logoutAction } from '@/app/(auth)/login/actions'

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav
        className="sticky top-0 z-sticky h-14 px-4 flex items-center justify-between border-b border-border backdrop-blur-md"
        style={{ background: 'var(--color-surface)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', backgroundColor: 'oklch(15% 0.010 260 / 80%)' }}
      >
        {/* Left: logo mark + nav */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/reports"
            className="flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold shrink-0"
            style={{
              background: 'var(--color-accent-subtle)',
              border: '1px solid var(--color-accent-border)',
              color: 'var(--color-accent)',
            }}
            aria-label="Отчёты"
          >
            CT
          </Link>
          <Link href="/reports" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Отчёты
          </Link>
          <Link href="/waiters" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Официанты
          </Link>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          <Link
            href="/reports/new"
            className="btn btn-primary btn--sm"
          >
            + Новый отчёт
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost btn--sm">
              Выйти
            </button>
          </form>
        </div>
      </nav>
      {children}
    </>
  )
}
