'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logoutAction } from '@/app/(auth)/login/actions'

export default function FounderMobileMenu() {
  const [isOpen, setIsOpen] = useState(false)

  function close() {
    setIsOpen(false)
  }

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        className="btn btn-ghost btn--icon"
        aria-label={isOpen ? 'Закрыть меню' : 'Открыть меню'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {isOpen ? (
          /* X icon */
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          /* Hamburger icon */
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {isOpen && (
        <nav
          className="absolute top-full right-0 mt-1 flex flex-col min-w-[180px] py-1"
          style={{
            background: 'oklch(15% 0.010 260 / 95%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 'var(--z-overlay)',
          }}
        >
          <Link
            href="/dashboard"
            className="text-sm px-4 py-2.5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={close}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
          >
            Дашборд
          </Link>
          <Link
            href="/iiko"
            className="text-sm px-4 py-2.5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={close}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
          >
            iiko
          </Link>
          <Link
            href="/employees"
            className="text-sm px-4 py-2.5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={close}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
          >
            Сотрудники
          </Link>
          <Link
            href="/establishments"
            className="text-sm px-4 py-2.5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={close}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
          >
            Заведения
          </Link>
          <Link
            href="/approvers"
            className="text-sm px-4 py-2.5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={close}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
          >
            Согласующие
          </Link>
          <Link
            href="/waiter-log"
            className="text-sm px-4 py-2.5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={close}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
          >
            Журнал официантов
          </Link>
          <Link
            href="/expenses"
            className="text-sm px-4 py-2.5 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onClick={close}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
          >
            Бухгалтерия
          </Link>

          <div
            className="mx-3 my-1"
            style={{ height: '1px', background: 'var(--color-border-subtle)' }}
            aria-hidden="true"
          />

          <form action={logoutAction} className="px-3 pb-1">
            <button
              type="submit"
              className="btn btn-ghost btn--sm w-full"
              style={{ justifyContent: 'flex-start' }}
              onClick={close}
            >
              Выйти
            </button>
          </form>
        </nav>
      )}
    </div>
  )
}
