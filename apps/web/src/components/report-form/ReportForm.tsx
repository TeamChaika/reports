'use client'

import { useEffect, useTransition, useState, useOptimistic, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reportFormSchema } from '@shift-reports/shared'
import type { ReportFormValues, AddExpenseValues } from '@shift-reports/shared'
import { useAutosave } from '@/hooks/useAutosave'
import {
  saveDraftAction,
  submitReportAction,
  addExpenseAction,
  removeExpenseAction,
} from '@/app/(manager)/reports/new/actions'

type PaymentGroup = { id: string; name: string; code: string }
type ExpenseGroup = { id: string; name: string }
type Approver = { id: string; name: string; short_name: string }
type Expense = {
  id: string
  name: string
  amount: number
  group_id: string | null
  approver_name: string | null
  description: string | null
  added_by: string | null
}

interface Props {
  establishments: { id: string; name: string; code: string | null; config: Record<string, boolean> }[]
  paymentGroups: PaymentGroup[]
  expenseGroups: ExpenseGroup[]
  approvers: Approver[]
  defaultDate: string
  createDraftAction: (establishmentId: string, businessDate: string) => Promise<void>
  reportId?: string
  initialValues?: Partial<ReportFormValues>
  initialExpenses?: Expense[]
}

export function ReportForm({
  establishments,
  paymentGroups,
  expenseGroups,
  approvers,
  defaultDate,
  createDraftAction,
  reportId: initialReportId,
  initialValues,
  initialExpenses = [],
}: Props) {
  const defaultPayGroupAmounts = Object.fromEntries(paymentGroups.map(g => [g.id, 0]))

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportFormSchema),
    defaultValues: {
      establishmentId: establishments[0]?.id ?? '',
      businessDate: defaultDate,
      payGroupAmounts: defaultPayGroupAmounts,
      cashSubmitted: null,
      notes: '',
      ...initialValues,
    },
  })

  const { save, status: saveStatus } = useAutosave(initialReportId ?? null, saveDraftAction)
  const [isPending, startTransition] = useTransition()

  // Autosave on form change
  useEffect(() => {
    const { unsubscribe } = form.watch((values) => {
      if (initialReportId) save(values as ReportFormValues)
    })
    return unsubscribe
  }, [form, initialReportId, save])

  const payGroupAmounts = form.watch('payGroupAmounts')
  const revenueTotal = Object.values(payGroupAmounts ?? {}).reduce(
    (s: number, v) => s + ((v as number) || 0),
    0,
  )

  // ─── Collaborative expenses ───────────────────────────────────────────────
  const [optimisticExpenses, applyOptimistic] = useOptimistic(
    initialExpenses,
    (state, action: { type: 'add'; item: Expense } | { type: 'remove'; id: string }) => {
      if (action.type === 'add') return [...state, action.item]
      return state.filter(e => e.id !== action.id)
    },
  )

  const [expenseForm, setExpenseForm] = useState<AddExpenseValues>({
    name: '',
    amount: 0,
    approverId: undefined,
    approverName: undefined,
  })
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseError, setExpenseError] = useState('')

  const handleAddExpense = useCallback(async () => {
    if (!initialReportId) return
    if (!expenseForm.name.trim()) { setExpenseError('Укажите название'); return }
    if (!expenseForm.amount || expenseForm.amount <= 0) { setExpenseError('Укажите сумму'); return }

    const tempId = crypto.randomUUID()
    const approver = approvers.find(a => a.id === expenseForm.approverId)
    const snapshot = { ...expenseForm }

    startTransition(() => {
      applyOptimistic({
        type: 'add',
        item: {
          id: tempId,
          name: snapshot.name,
          amount: snapshot.amount,
          group_id: snapshot.groupId ?? null,
          approver_name: approver?.short_name ?? null,
          description: snapshot.description ?? null,
          added_by: null,
        },
      })
    })

    setShowExpenseForm(false)
    setExpenseError('')
    setExpenseForm({ name: '', amount: 0, approverId: undefined })

    const result = await addExpenseAction(initialReportId, snapshot)
    if (!result.ok) {
      startTransition(() => applyOptimistic({ type: 'remove', id: tempId }))
      setExpenseError(result.error ?? 'Ошибка')
      setShowExpenseForm(true)
    }
  }, [initialReportId, expenseForm, approvers, applyOptimistic, startTransition])

  const handleRemoveExpense = useCallback(async (id: string) => {
    if (!initialReportId) return
    startTransition(() => applyOptimistic({ type: 'remove', id }))
    const result = await removeExpenseAction(id)
    if (!result.ok) {
      window.location.reload()
    }
  }, [initialReportId, applyOptimistic, startTransition])

  const handleCreateAndSubmit = form.handleSubmit(async (values) => {
    if (!initialReportId) {
      startTransition(() => createDraftAction(values.establishmentId, values.businessDate))
    } else {
      const result = await submitReportAction(initialReportId, values)
      if (!result.ok) alert(result.error)
    }
  })

  const statusLabel = { idle: '', saving: 'Сохраняем...', saved: 'Сохранено', error: 'Ошибка' }[saveStatus]
  const expensesTotal = optimisticExpenses.reduce((s, e) => s + e.amount, 0)
  const groupName = (groupId: string | null) => expenseGroups.find(g => g.id === groupId)?.name ?? '—'

  return (
    <form onSubmit={handleCreateAndSubmit} className="flex flex-col gap-4">
      {/* Establishment + Date */}
      <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Заведение и дата</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Заведение</label>
            <select
              {...form.register('establishmentId')}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
            >
              {establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>Дата смены</label>
            <input
              type="date"
              {...form.register('businessDate')}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
            />
          </div>
        </div>
      </section>

      {/* Revenue by payment group */}
      <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Выручка по группам оплаты</h2>
        <div className="flex flex-col gap-3">
          {paymentGroups.map(g => (
            <div key={g.id} className="flex items-center justify-between gap-3">
              <label className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>{g.name}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register(`payGroupAmounts.${g.id}`, { valueAsNumber: true })}
                className="w-36 px-3 py-2 rounded-lg text-sm text-right"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
              />
            </div>
          ))}
          <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Итого</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>
              {revenueTotal.toLocaleString('ru')} ₽
            </span>
          </div>
        </div>
      </section>

      {/* Cash submitted */}
      <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Касса</h2>
        <div>
          <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--color-text-muted)' }}>
            Сдано наличных в бухгалтерию
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            {...form.register('cashSubmitted', { valueAsNumber: true })}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
          />
        </div>
      </section>

      {/* Collaborative expenses */}
      <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Расходы</h2>
            {optimisticExpenses.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Итого: {expensesTotal.toLocaleString('ru')} ₽
              </p>
            )}
          </div>
            {initialReportId ? (
            <button
              type="button"
              onClick={() => setShowExpenseForm(v => !v)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg"
              style={{ background: 'var(--color-accent)', color: 'white' }}
            >
              + Добавить
            </button>
          ) : (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Сначала создайте черновик
            </span>
          )}
        </div>

        {/* Add expense form — manager fills name, amount, approver only */}
        {showExpenseForm && (
          <div className="mb-4 p-3 rounded-lg flex flex-col gap-2" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <input
              placeholder="Название расхода (напр. «Бумага А4», «Реклама ВК»)"
              value={expenseForm.name}
              onChange={e => setExpenseForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-2 py-1.5 rounded-lg text-sm"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Сумма ₽"
              value={expenseForm.amount || ''}
              onChange={e => setExpenseForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-2 py-1.5 rounded-lg text-sm text-right"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
            />
            <select
              value={expenseForm.approverId ?? ''}
              onChange={e => {
                const approver = approvers.find(a => a.id === e.target.value)
                setExpenseForm(f => ({
                  ...f,
                  approverId: e.target.value || undefined,
                  approverName: approver?.short_name,
                }))
              }}
              className="w-full px-2 py-1.5 rounded-lg text-sm"
              style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
            >
              <option value="">Кто согласовал?</option>
              {approvers.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.short_name})</option>
              ))}
            </select>
            {expenseError && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{expenseError}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowExpenseForm(false); setExpenseError('') }} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
                Отмена
              </button>
              <button type="button" onClick={handleAddExpense} className="text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-accent)', color: 'white' }}>
                Сохранить
              </button>
            </div>
          </div>
        )}

        {/* Expense list */}
        {optimisticExpenses.length === 0 && !showExpenseForm && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Расходов нет</p>
        )}
        <div className="flex flex-col gap-2">
          {optimisticExpenses.map(e => (
            <div key={e.id} className="flex items-start gap-3 p-2 rounded-lg" style={{ background: 'var(--color-bg)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{e.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {e.approver_name && <>Согл. <span className="font-medium">{e.approver_name}</span></>}
                  {e.group_id && <> · {groupName(e.group_id)}</>}
                </p>
              </div>
              <span className="text-sm font-medium shrink-0" style={{ color: 'var(--color-text)' }}>
                {e.amount.toLocaleString('ru')} ₽
              </span>
              {initialReportId && (
                <button
                  type="button"
                  onClick={() => handleRemoveExpense(e.id)}
                  className="text-xs shrink-0"
                  style={{ color: 'var(--color-danger)' }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Заметки</h2>
        <textarea
          {...form.register('notes')}
          rows={3}
          placeholder="Комментарий к смене..."
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}
        />
      </section>

      {/* Submit bar */}
      <div className="sticky bottom-4 mt-2">
        <div
          className="p-4 rounded-xl flex items-center justify-between gap-4"
          style={{ background: 'var(--color-text)', boxShadow: '0 4px 24px oklch(0% 0 0 / 20%)' }}
        >
          <p className="text-xs" style={{ color: 'oklch(70% 0 0)' }}>
            {statusLabel || `Выручка: ${revenueTotal.toLocaleString('ru')} ₽`}
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: 'white' }}
          >
            {initialReportId ? 'Отправить отчёт' : 'Создать отчёт'}
          </button>
        </div>
      </div>
    </form>
  )
}
