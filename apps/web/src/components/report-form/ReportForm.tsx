'use client'

import { useEffect, useTransition, useState, useOptimistic, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reportFormSchema } from '@shift-reports/shared'
import type { ReportFormValues, AddExpenseValues } from '@shift-reports/shared'
import { useAutosave } from '@/hooks/useAutosave'
import { fmtNum } from '@/lib/format'
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
  added_by_name: string | null
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
  currentUserName?: string | null
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
  currentUserName,
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
  const [submitted, setSubmitted] = useState(false)
  const router = useRouter()

  // Autosave on form change (stops once the report has been submitted)
  useEffect(() => {
    const { unsubscribe } = form.watch((values) => {
      if (initialReportId && !submitted) save(values as ReportFormValues)
    })
    return unsubscribe
  }, [form, initialReportId, save, submitted])

  const payGroupAmounts = form.watch('payGroupAmounts')
  const revenueTotal = Object.values(payGroupAmounts ?? {}).reduce(
    (s: number, v) => s + ((v as number) || 0),
    0,
  )

  const cashGroupId = paymentGroups.find(g => g.code === 'cash')?.id

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

    setShowExpenseForm(false)
    setExpenseError('')
    setExpenseForm({ name: '', amount: 0, approverId: undefined })

    startTransition(async () => {
      applyOptimistic({
        type: 'add',
        item: {
          id: tempId,
          name: snapshot.name,
          amount: snapshot.amount,
          group_id: snapshot.groupId ?? null,
          approver_name: approver?.short_name ?? null,
          description: snapshot.description ?? null,
          added_by_name: currentUserName ?? null,
        },
      })
      const result = await addExpenseAction(initialReportId, snapshot)
      if (!result.ok) {
        applyOptimistic({ type: 'remove', id: tempId })
        setExpenseError(result.error ?? 'Ошибка')
        setShowExpenseForm(true)
      }
    })
  }, [initialReportId, expenseForm, approvers, applyOptimistic, startTransition])

  const handleRemoveExpense = useCallback(async (id: string) => {
    if (!initialReportId) return
    startTransition(async () => {
      applyOptimistic({ type: 'remove', id })
      const result = await removeExpenseAction(id, initialReportId)
      if (!result.ok) {
        window.location.reload()
      }
    })
  }, [initialReportId, applyOptimistic, startTransition])

  const handleCreateAndSubmit = form.handleSubmit(async (values) => {
    if (!initialReportId) {
      startTransition(() => createDraftAction(values.establishmentId, values.businessDate))
    } else {
      const result = await submitReportAction(initialReportId, values)
      if (result.ok) {
        // Stop autosave (report is no longer a draft) and leave the edit page
        setSubmitted(true)
        router.push('/reports')
      } else {
        alert(result.error)
      }
    }
  })

  const statusLabel = { idle: '', saving: 'Сохраняем...', saved: 'Сохранено', error: 'Ошибка' }[saveStatus]
  const expensesTotal = optimisticExpenses.reduce((s, e) => s + e.amount, 0)
  const groupName = (groupId: string | null) => expenseGroups.find(g => g.id === groupId)?.name ?? '—'

  // Auto-calculate cash submitted: cash revenue minus expenses
  useEffect(() => {
    if (!cashGroupId) return
    const cashAmount = (payGroupAmounts?.[cashGroupId] as number) || 0
    form.setValue('cashSubmitted', Math.max(0, cashAmount - expensesTotal))
  }, [cashGroupId, payGroupAmounts, expensesTotal, form])

  return (
    <form onSubmit={handleCreateAndSubmit} className="flex flex-col gap-4">
      {/* Establishment + Date */}
      <section
        className="rounded-xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-4)' }}
      >
        <h2 className="text-sm font-semibold mb-3 text-text">Заведение и дата</h2>
        <div className="flex flex-col gap-3">
          <div className="form-group">
            <label className="label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Заведение
            </label>
            <select
              {...form.register('establishmentId')}
              className="input input--select"
            >
              {establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Дата смены
            </label>
            <input
              type="date"
              {...form.register('businessDate')}
              className="input"
            />
          </div>
        </div>
      </section>

      {/* Revenue by payment group */}
      <section
        className="rounded-xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-4)' }}
      >
        <h2 className="text-sm font-semibold mb-3 text-text">Выручка по группам оплаты</h2>
        <div className="flex flex-col gap-3">
          {paymentGroups.map(g => (
            <div key={g.id} className="flex items-center justify-between gap-3">
              <label className="text-sm flex-1 text-text">{g.name}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                {...form.register(`payGroupAmounts.${g.id}`, { valueAsNumber: true })}
                className="input input--number"
                style={{ width: '9rem' }}
              />
            </div>
          ))}
          <div
            className="flex items-center justify-between pt-2 mt-1"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <span className="text-sm font-semibold text-text">Итого</span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-accent)' }}>
              {fmtNum(revenueTotal)} ₽
            </span>
          </div>
        </div>
      </section>

      {/* Cash submitted */}
      <section
        className="rounded-xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-4)' }}
      >
        <h2 className="text-sm font-semibold mb-3 text-text">Касса</h2>
        <div className="form-group">
          <div className="flex items-center justify-between mb-1">
            <label className="label" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Сдано наличных в бухгалтерию
            </label>
            {cashGroupId && (
              <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                Наличные − расходы
              </span>
            )}
          </div>
          <input
            type="number"
            min="0"
            step="0.01"
            {...form.register('cashSubmitted', { valueAsNumber: true })}
            className="input input--number"
          />
        </div>
      </section>

      {/* Collaborative expenses */}
      <section
        className="rounded-xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-4)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-text">Расходы</h2>
            {optimisticExpenses.length > 0 && (
              <p className="text-xs mt-0.5 text-text-muted tabular-nums">
                Итого: {fmtNum(expensesTotal)} ₽
              </p>
            )}
          </div>
          {initialReportId ? (
            <button
              type="button"
              onClick={() => setShowExpenseForm(v => !v)}
              className="btn btn-primary btn--sm"
            >
              + Добавить
            </button>
          ) : (
            <span className="text-xs text-text-muted">
              Сначала создайте черновик
            </span>
          )}
        </div>

        {/* Add expense form */}
        {showExpenseForm && (
          <div
            className="mb-4 rounded-lg flex flex-col gap-2"
            style={{
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              padding: 'var(--space-3)',
            }}
          >
            <input
              placeholder="Название расхода (напр. «Бумага А4», «Реклама ВК»)"
              value={expenseForm.name}
              onChange={e => setExpenseForm(f => ({ ...f, name: e.target.value }))}
              className="input input--sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Сумма ₽"
              value={expenseForm.amount || ''}
              onChange={e => setExpenseForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
              className="input input--sm input--number"
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
              className="input input--select input--sm"
            >
              <option value="">Кто согласовал?</option>
              {approvers.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({a.short_name})</option>
              ))}
            </select>
            {expenseError && (
              <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{expenseError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowExpenseForm(false); setExpenseError('') }}
                className="btn btn-ghost btn--sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleAddExpense}
                className="btn btn-primary btn--sm"
              >
                Сохранить
              </button>
            </div>
          </div>
        )}

        {/* Expense list */}
        {optimisticExpenses.length === 0 && !showExpenseForm && (
          <p className="text-xs text-text-muted">Расходов нет</p>
        )}
        <div className="flex flex-col gap-2">
          {optimisticExpenses.map(e => (
            <div
              key={e.id}
              className="flex items-start gap-3 rounded-lg"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border-subtle)',
                padding: 'var(--space-2) var(--space-3)',
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text">{e.name}</p>
                <p className="text-xs mt-0.5 text-text-muted">
                  {e.approver_name && <>Согл. <span className="font-medium">{e.approver_name}</span></>}
                  {e.group_id && <> · {groupName(e.group_id)}</>}
                  {e.added_by_name && <> · {e.added_by_name.toLowerCase()}</>}
                </p>
              </div>
              <span className="text-sm font-medium shrink-0 tabular-nums text-text">
                {fmtNum(e.amount)} ₽
              </span>
              {initialReportId && (
                <button
                  type="button"
                  onClick={() => handleRemoveExpense(e.id)}
                  className="btn btn-danger btn--sm btn--icon shrink-0"
                  aria-label="Удалить расход"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section
        className="rounded-xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-4)' }}
      >
        <h2 className="text-sm font-semibold mb-3 text-text">Заметки</h2>
        <textarea
          {...form.register('notes')}
          rows={3}
          placeholder="Комментарий к смене..."
          className="input input--textarea"
        />
      </section>

      {/* Sticky submit bar — FIXED: uses surface-raised, not text color */}
      <div className="sticky bottom-4 mt-2">
        <div
          className="rounded-xl flex items-center justify-between gap-4"
          style={{
            background: 'var(--color-surface-raised)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--color-border)',
            padding: 'var(--space-4)',
          }}
        >
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>
              {fmtNum(revenueTotal)} ₽
            </p>
            {statusLabel && (
              <span
                className={`badge ${saveStatus === 'error' ? 'badge-danger' : saveStatus === 'saved' ? 'badge-success' : 'badge-neutral'}`}
              >
                {statusLabel}
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="btn btn-primary"
          >
            {initialReportId ? 'Отправить отчёт' : 'Создать отчёт'}
          </button>
        </div>
      </div>
    </form>
  )
}
