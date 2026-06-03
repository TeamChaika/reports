'use client'

import { useState, useTransition } from 'react'
import {
  createApproverAction,
  setApproverActiveAction,
  setApproverGlobalAction,
  setApproverEstablishmentsAction,
} from './actions'

type Est = { id: string; name: string }
export type Approver = {
  id: string
  name: string
  short_name: string
  is_global: boolean
  establishment_ids: string[]
}

function EstablishmentPicker({
  establishments,
  selected,
  onToggle,
}: {
  establishments: Est[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {establishments.map(e => {
        const on = selected.has(e.id)
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onToggle(e.id)}
            className={on ? 'badge badge-info' : 'badge badge-neutral'}
            style={{ cursor: 'pointer', opacity: on ? 1 : 0.6 }}
          >
            {e.name}
          </button>
        )
      })}
    </div>
  )
}

function AddForm({ establishments }: { establishments: Est[] }) {
  const [name, setName] = useState('')
  const [short, setShort] = useState('')
  const [global, setGlobal] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function toggle(id: string) {
    setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function submit() {
    setError('')
    startTransition(async () => {
      const r = await createApproverAction({ name, short_name: short, is_global: global, establishment_ids: [...sel] })
      if (r.ok) { setName(''); setShort(''); setGlobal(false); setSel(new Set()) }
      else setError(r.error ?? 'Ошибка')
    })
  }

  return (
    <div className="rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Новый согласующий</h2>
      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="label text-xs text-text-muted">ФИО</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Иванов Иван Иванович" className="input input--sm" />
        </div>
        <div>
          <label className="label text-xs text-text-muted">Краткое (для отчёта)</label>
          <input value={short} onChange={e => setShort(e.target.value)} placeholder="И.И." className="input input--sm" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm mb-3" style={{ color: 'var(--color-text)', cursor: 'pointer' }}>
        <input type="checkbox" checked={global} onChange={e => setGlobal(e.target.checked)} />
        Глобальный (согласует в любом заведении)
      </label>
      {!global && (
        <div className="mb-3">
          <label className="label text-xs text-text-muted mb-1 block">Заведения</label>
          <EstablishmentPicker establishments={establishments} selected={sel} onToggle={toggle} />
        </div>
      )}
      {error && <p className="text-xs mb-2" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      <button type="button" onClick={submit} disabled={isPending} className="btn btn-primary btn--sm">
        {isPending ? 'Сохраняю…' : 'Добавить'}
      </button>
    </div>
  )
}

function ApproverRow({ approver, establishments }: { approver: Approver; establishments: Est[] }) {
  const [editing, setEditing] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set(approver.establishment_ids))
  const [isPending, startTransition] = useTransition()

  const estName = new Map(establishments.map(e => [e.id, e.name]))

  function toggleGlobal() {
    startTransition(async () => { await setApproverGlobalAction(approver.id, !approver.is_global) })
  }
  function deactivate() {
    startTransition(async () => { await setApproverActiveAction(approver.id, false) })
  }
  function toggleEst(id: string) {
    setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function saveEst() {
    startTransition(async () => {
      await setApproverEstablishmentsAction(approver.id, [...sel])
      setEditing(false)
    })
  }

  return (
    <div className="py-3" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {approver.name} <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>· {approver.short_name}</span>
          </p>
          <div className="mt-1">
            {approver.is_global ? (
              <span className="badge badge-success">Глобальный</span>
            ) : approver.establishment_ids.length === 0 ? (
              <span className="text-xs" style={{ color: 'var(--color-warning)' }}>Нет заведений</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {approver.establishment_ids.map(id => (
                  <span key={id} className="tag">{estName.get(id) ?? '—'}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={approver.is_global} onChange={toggleGlobal} disabled={isPending} />
            глобальный
          </label>
          {!approver.is_global && (
            <button type="button" onClick={() => setEditing(e => !e)} className="btn btn-ghost btn--sm">
              {editing ? 'Закрыть' : 'Заведения'}
            </button>
          )}
          <button type="button" onClick={deactivate} disabled={isPending} className="btn btn-danger btn--sm">
            Убрать
          </button>
        </div>
      </div>

      {editing && !approver.is_global && (
        <div className="mt-2 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: 'var(--space-3)' }}>
          <EstablishmentPicker establishments={establishments} selected={sel} onToggle={toggleEst} />
          <div className="flex justify-end mt-2">
            <button type="button" onClick={saveEst} disabled={isPending} className="btn btn-primary btn--sm">Сохранить</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ApproversManager({ approvers, establishments }: { approvers: Approver[]; establishments: Est[] }) {
  return (
    <>
      <AddForm establishments={establishments} />
      <div className="rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
          Согласующие <span className="text-xs ml-1" style={{ color: 'var(--color-text-disabled)' }}>{approvers.length}</span>
        </h2>
        {approvers.length === 0 ? (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>Согласующих нет</p>
        ) : (
          approvers.map(a => <ApproverRow key={a.id} approver={a} establishments={establishments} />)
        )}
      </div>
    </>
  )
}
