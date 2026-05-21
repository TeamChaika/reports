'use client'

import { useState, useTransition, useOptimistic } from 'react'
import { assignCategoryAction, removeCategoryAction } from './actions'

type ExpenseGroup = { id: string; name: string }
type Expense = {
  id: string
  name: string
  amount: number
  approver_name: string | null
  group_id: string | null
  created_at: string
  report_id: string
  report: { business_date: string; establishment: { name: string } | null }
}

interface Props {
  expenses: Expense[]
  expenseGroups: ExpenseGroup[]
}

export function ExpenseTable({ expenses, expenseGroups }: Props) {
  const [filter, setFilter] = useState<'uncategorized' | 'all'>('uncategorized')
  const [isPending, startTransition] = useTransition()

  const [optimisticExpenses, applyOptimistic] = useOptimistic(
    expenses,
    (state, { id, groupId }: { id: string; groupId: string | null }) =>
      state.map(e => e.id === id ? { ...e, group_id: groupId } : e),
  )

  const visible = filter === 'uncategorized'
    ? optimisticExpenses.filter(e => !e.group_id)
    : optimisticExpenses

  const uncategorizedCount = optimisticExpenses.filter(e => !e.group_id).length
  const totalAmount = visible.reduce((s, e) => s + e.amount, 0)

  const groupName = (gid: string | null) =>
    gid ? (expenseGroups.find(g => g.id === gid)?.name ?? '—') : null

  async function handleAssign(expenseId: string, groupId: string) {
    startTransition(() => applyOptimistic({ id: expenseId, groupId }))
    await assignCategoryAction(expenseId, groupId)
  }

  async function handleRemove(expenseId: string) {
    startTransition(() => applyOptimistic({ id: expenseId, groupId: null }))
    await removeCategoryAction(expenseId)
  }

  // Group by establishment + date
  const grouped = visible.reduce<Record<string, { label: string; items: typeof visible }>>((acc, e) => {
    const key = `${e.report.establishment?.name ?? '?'} — ${e.report.business_date}`
    if (!acc[key]) acc[key] = { label: key, items: [] }
    acc[key].items.push(e)
    return acc
  }, {})

  return (
    <div className="flex flex-col gap-4">
      {/* Filters + stats */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {(['uncategorized', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{
                background: filter === f ? 'var(--color-accent)' : 'transparent',
                color: filter === f ? 'white' : 'var(--color-text-muted)',
              }}
            >
              {f === 'uncategorized'
                ? `Без категории ${uncategorizedCount > 0 ? `(${uncategorizedCount})` : ''}`
                : 'Все расходы'}
            </button>
          ))}
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
          {visible.length} позиций · {totalAmount.toLocaleString('ru')} ₽
        </span>
      </div>

      {visible.length === 0 && (
        <div className="p-8 text-center rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {filter === 'uncategorized' ? '✓ Все расходы категоризированы' : 'Расходов нет'}
          </p>
        </div>
      )}

      {Object.entries(grouped).map(([key, { label, items }]) => {
        const groupTotal = items.reduce((s, e) => s + e.amount, 0)
        return (
          <section key={key} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
            {/* Group header */}
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{label}</span>
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {groupTotal.toLocaleString('ru')} ₽
              </span>
            </div>

            {/* Expenses */}
            <div style={{ background: 'var(--color-bg)' }}>
              {items.map((expense, i) => (
                <div
                  key={expense.id}
                  className="px-4 py-3 flex items-center gap-3"
                  style={{
                    borderTop: i > 0 ? '1px solid var(--color-border)' : undefined,
                  }}
                >
                  {/* Name + approver */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {expense.name}
                    </p>
                    {expense.approver_name && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        Согл. {expense.approver_name}
                      </p>
                    )}
                  </div>

                  {/* Amount */}
                  <span className="text-sm font-semibold shrink-0 w-24 text-right" style={{ color: 'var(--color-text)' }}>
                    {expense.amount.toLocaleString('ru')} ₽
                  </span>

                  {/* Category selector */}
                  <div className="shrink-0 w-52">
                    {expense.group_id ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-medium px-2 py-1 rounded-md flex-1 text-center"
                          style={{ background: 'oklch(65% 0.18 145 / 15%)', color: 'oklch(45% 0.18 145)' }}
                        >
                          {groupName(expense.group_id)}
                        </span>
                        <button
                          onClick={() => handleRemove(expense.id)}
                          disabled={isPending}
                          className="text-xs shrink-0"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Снять категорию"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        defaultValue=""
                        onChange={e => { if (e.target.value) handleAssign(expense.id, e.target.value) }}
                        disabled={isPending}
                        className="w-full px-2 py-1.5 rounded-md text-xs"
                        style={{
                          border: '1px solid oklch(65% 0.18 60 / 60%)',
                          background: 'oklch(65% 0.18 60 / 8%)',
                          color: 'var(--color-text)',
                        }}
                      >
                        <option value="">— назначить категорию —</option>
                        {expenseGroups.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
