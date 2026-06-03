'use client'

import { useState, useTransition } from 'react'
import { createAccountingExpenseAction, type Allocation } from './actions'

type Est = { id: string; name: string }
type Group = { id: string; name: string }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function AccountingExpenseForm({ establishments, groups }: { establishments: Est[]; groups: Group[] }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(todayStr())
  const [name, setName] = useState('')
  const [groupId, setGroupId] = useState('')
  const [payment, setPayment] = useState<'cash' | 'noncash'>('noncash')
  const [total, setTotal] = useState('')
  const [mode, setMode] = useState<'amount' | 'percent'>('amount')
  const [alloc, setAlloc] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const totalNum = Number(total) || 0
  const selectedIds = Object.keys(alloc)

  function toggleEst(id: string) {
    setAlloc(a => {
      const n = { ...a }
      if (id in n) delete n[id]
      else n[id] = 0
      return n
    })
  }
  function setVal(id: string, v: string) {
    setAlloc(a => ({ ...a, [id]: parseFloat(v) || 0 }))
  }
  function splitEqually() {
    if (selectedIds.length === 0) return
    if (mode === 'amount') {
      const per = Math.round((totalNum / selectedIds.length) * 100) / 100
      setAlloc(Object.fromEntries(selectedIds.map(id => [id, per])))
    } else {
      const per = Math.round((100 / selectedIds.length) * 100) / 100
      setAlloc(Object.fromEntries(selectedIds.map(id => [id, per])))
    }
  }

  function computeAllocations(): Allocation[] {
    if (mode === 'amount') {
      return selectedIds.map(id => ({ establishment_id: id, amount: Number(alloc[id]) || 0 }))
    }
    // percent → amounts, last absorbs rounding so the sum equals the total
    let acc = 0
    return selectedIds.map((id, i) => {
      const amount = i === selectedIds.length - 1
        ? Math.round((totalNum - acc) * 100) / 100
        : Math.round(totalNum * ((Number(alloc[id]) || 0) / 100) * 100) / 100
      acc += amount
      return { establishment_id: id, amount }
    })
  }

  const allocSum = selectedIds.reduce((s, id) => s + (Number(alloc[id]) || 0), 0)
  const remaining = mode === 'amount' ? totalNum - allocSum : 100 - allocSum

  function reset() {
    setName(''); setGroupId(''); setTotal(''); setAlloc({}); setError(''); setPayment('noncash')
  }

  function submit() {
    setError('')
    if (name.trim().length < 2) { setError('Укажите название'); return }
    if (!(totalNum > 0)) { setError('Укажите сумму'); return }
    if (selectedIds.length === 0) { setError('Выберите заведения'); return }
    const allocations = computeAllocations()
    const sum = allocations.reduce((s, a) => s + a.amount, 0)
    if (Math.abs(sum - totalNum) > 1) {
      setError(mode === 'amount' ? 'Суммы не сходятся с итогом' : 'Проценты должны давать 100%')
      return
    }
    startTransition(async () => {
      const result = await createAccountingExpenseAction({
        expense_date: date,
        name: name.trim(),
        group_id: groupId || null,
        payment_type: payment,
        total_amount: totalNum,
        allocations,
      })
      if (result.ok) { reset(); setOpen(false) }
      else setError(result.error ?? 'Ошибка')
    })
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        + Добавить расход
      </button>
    )
  }

  return (
    <div className="rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Новый расход</h2>

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div className="form-group">
          <label className="label text-xs text-text-muted">Дата</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input input--sm" />
        </div>
        <div className="form-group">
          <label className="label text-xs text-text-muted">Категория</label>
          <select value={groupId} onChange={e => setGroupId(e.target.value)} className="input input--sm input--select">
            <option value="">— без категории —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group mb-3">
        <label className="label text-xs text-text-muted">Название</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Напр. «Керхер для мойки»" className="input input--sm" />
      </div>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="form-group">
          <label className="label text-xs text-text-muted">Тип оплаты</label>
          <div className="flex gap-1 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '2px' }}>
            <button type="button" onClick={() => setPayment('cash')} className={payment === 'cash' ? 'btn btn-secondary btn--sm' : 'btn btn-ghost btn--sm'} style={{ flex: 1 }}>Наличные</button>
            <button type="button" onClick={() => setPayment('noncash')} className={payment === 'noncash' ? 'btn btn-secondary btn--sm' : 'btn btn-ghost btn--sm'} style={{ flex: 1 }}>Безнал</button>
          </div>
        </div>
        <div className="form-group">
          <label className="label text-xs text-text-muted">Сумма, ₽</label>
          <input type="number" min="0" step="0.01" value={total} onChange={e => setTotal(e.target.value)} className="input input--sm input--number" />
        </div>
      </div>

      {/* Distribution */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="label text-xs text-text-muted" style={{ margin: 0 }}>Распределение по заведениям</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={splitEqually} className="btn btn-ghost btn--sm">поровну</button>
            <div className="flex gap-1 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: '2px' }}>
              <button type="button" onClick={() => setMode('amount')} className={mode === 'amount' ? 'btn btn-secondary btn--sm' : 'btn btn-ghost btn--sm'}>Суммы</button>
              <button type="button" onClick={() => setMode('percent')} className={mode === 'percent' ? 'btn btn-secondary btn--sm' : 'btn btn-ghost btn--sm'}>Проценты</button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {establishments.map(e => {
            const selected = e.id in alloc
            return (
              <div key={e.id} className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm flex-1" style={{ color: 'var(--color-text)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selected} onChange={() => toggleEst(e.id)} />
                  {e.name}
                </label>
                {selected && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" step="0.01"
                      value={alloc[e.id] || ''}
                      onChange={ev => setVal(e.id, ev.target.value)}
                      className="input input--sm input--number"
                      style={{ width: '7rem' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--color-text-disabled)', width: '14px' }}>
                      {mode === 'amount' ? '₽' : '%'}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {selectedIds.length > 0 && (
          <p className="text-xs mt-2 tabular-nums" style={{ color: Math.abs(remaining) < 1 ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {mode === 'amount'
              ? `Распределено ${Math.round(allocSum).toLocaleString('ru')} из ${Math.round(totalNum).toLocaleString('ru')} ₽ · остаток ${Math.round(remaining).toLocaleString('ru')} ₽`
              : `Сумма процентов: ${allocSum.toFixed(0)}% · осталось ${remaining.toFixed(0)}%`}
          </p>
        )}
      </div>

      {error && <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" onClick={() => { reset(); setOpen(false) }} className="btn btn-ghost btn--sm">Отмена</button>
        <button type="button" onClick={submit} disabled={isPending} className="btn btn-primary btn--sm">
          {isPending ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}
