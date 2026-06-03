'use client'

import { fmtNum } from '@/lib/format'
import { useTransition } from 'react'
import { deleteAccountingExpenseAction } from './actions'

export type ExpenseItem = {
  id: string
  expense_date: string
  name: string
  category: string
  payment_type: 'cash' | 'noncash'
  total_amount: number
  allocations: { establishment: string; amount: number }[]
}

export function AccountingExpensesList({ items }: { items: ExpenseItem[] }) {
  const [isPending, startTransition] = useTransition()

  function remove(id: string) {
    startTransition(async () => { await deleteAccountingExpenseAction(id) })
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Расходов за период нет</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map(e => (
        <div key={e.id} className="rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-4)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{e.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {e.expense_date} · {e.category}
                <span className="ml-1.5 badge badge-neutral">{e.payment_type === 'cash' ? 'Наличные' : 'Безнал'}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>
                {fmtNum(e.total_amount)} ₽
              </span>
              <button
                type="button"
                onClick={() => remove(e.id)}
                disabled={isPending}
                className="btn btn-danger btn--sm btn--icon"
                aria-label="Удалить расход"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Allocation breakdown — show only when split across more than one */}
          {e.allocations.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
              {e.allocations.map((a, i) => (
                <span key={i} className="tag tabular-nums">
                  {a.establishment}: {fmtNum(a.amount)} ₽
                </span>
              ))}
            </div>
          )}
          {e.allocations.length === 1 && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--color-text-disabled)' }}>
              {e.allocations[0]!.establishment}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
