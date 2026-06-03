import Link from 'next/link'
import { logoutAction } from '@/app/(auth)/login/actions'
import FounderMobileMenu from './FounderMobileMenu'

export default function FounderLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav
        className="sticky top-0 z-sticky h-14 px-4 flex items-center justify-between border-b border-border"
        style={{ backgroundColor: 'oklch(15% 0.010 260 / 80%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        {/* Left: logo + desktop nav links */}
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

          <div className="hidden sm:flex items-center gap-5">
            <span style={{ color: 'var(--color-border)' }} aria-hidden="true">·</span>
            {[
              { href: '/dashboard', label: 'Дашборд' },
              { href: '/iiko', label: 'iiko' },
              { href: '/employees', label: 'Сотрудники' },
              { href: '/establishments', label: 'Заведения' },
              { href: '/approvers', label: 'Согласующие' },
              { href: '/expenses', label: 'Бухгалтерия' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: logout (desktop) + hamburger (mobile) */}
        <div className="flex items-center gap-2">
          <form action={logoutAction} className="hidden sm:block">
            <button type="submit" className="btn btn-ghost btn--sm">
              Выйти
            </button>
          </form>
          <FounderMobileMenu />
        </div>
      </nav>
      {children}
    </>
  )
}
