import Link from 'next/link'
import { logoutAction } from '@/app/(auth)/login/actions'

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <Link
          href="/reports"
          className="text-sm font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          Shift Reports
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/reports/new"
            className="text-sm font-medium px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--color-accent)', color: 'white' }}
          >
            + Новый отчёт
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Выйти
            </button>
          </form>
        </div>
      </nav>
      {children}
    </>
  )
}
