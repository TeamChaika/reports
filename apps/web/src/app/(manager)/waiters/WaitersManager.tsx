'use client'

import { useState, useTransition, useMemo } from 'react'
import { updateWaiterAction } from './actions'

export type Waiter = {
  id: string
  name: string
  code: string | null
  establishment: string
}

// Split "Имя_10004389402332" → { base: "Имя", sber: "10004389402332" }
function splitName(name: string): { base: string; sber: string } {
  const m = name.match(/^(.*)_(\d{6,})$/)
  if (m) return { base: m[1] ?? '', sber: m[2] ?? '' }
  return { base: name, sber: '' }
}

function EditRow({ waiter, onDone }: { waiter: Waiter; onDone: () => void }) {
  const parsed = splitName(waiter.name)
  const [name, setName] = useState(parsed.base)
  const [sber, setSber] = useState(parsed.sber)
  const [card, setCard] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function save() {
    setError('')
    if (name.trim().length < 2) { setError('Укажите имя'); return }
    if (pin && !/^\d{4,6}$/.test(pin)) { setError('Пин-код — 4–6 цифр'); return }
    startTransition(async () => {
      const result = await updateWaiterAction({
        iikoId: waiter.id,
        name: name.trim(),
        sberTipsId: sber.trim() || undefined,
        cardNumber: card.trim() || undefined,
        pinCode: pin.trim() || undefined,
      })
      if (result.ok) onDone()
      else setError(result.error ?? 'Ошибка')
    })
  }

  return (
    <div
      className="rounded-lg mt-2 flex flex-col gap-2"
      style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', padding: 'var(--space-3)' }}
    >
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="label text-xs text-text-muted">Имя в системе</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input input--sm" />
        </div>
        <div>
          <label className="label text-xs text-text-muted">Сбер Чаевые (id)</label>
          <input value={sber} onChange={e => setSber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="напр. 10004389402332" className="input input--sm input--number" />
        </div>
        <div>
          <label className="label text-xs text-text-muted">Номер карты</label>
          <input value={card} onChange={e => setCard(e.target.value)} placeholder="оставить пустым — не менять" className="input input--sm" />
        </div>
        <div>
          <label className="label text-xs text-text-muted">Новый пин-код</label>
          <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="пусто — не менять" className="input input--sm input--number" />
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
        Имя в iiko: {sber ? `${name || '…'}_${sber}` : (name || '…')}
      </p>
      {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onDone} className="btn btn-ghost btn--sm">Отмена</button>
        <button type="button" onClick={save} disabled={isPending} className="btn btn-primary btn--sm">
          {isPending ? 'Сохраняю…' : 'Сохранить в iiko'}
        </button>
      </div>
    </div>
  )
}

export function WaitersManager({ waiters }: { waiters: Waiter[] }) {
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return waiters
    return waiters.filter(w => w.name.toLowerCase().includes(q) || String(w.code ?? '').includes(q))
  }, [waiters, query])

  return (
    <div className="rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Официанты заведений
          <span className="text-xs ml-1.5" style={{ color: 'var(--color-text-disabled)' }}>{waiters.length}</span>
        </h2>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Поиск по имени или таб. №"
          className="input input--sm"
          style={{ maxWidth: '260px' }}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ничего не найдено</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map(w => (
            <div key={w.id}>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className="text-sm truncate-1" style={{ color: 'var(--color-text)' }}>{w.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                    таб. {w.code ?? '—'} · {w.establishment}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(editing === w.id ? null : w.id)}
                  className="btn btn-ghost btn--sm shrink-0"
                >
                  {editing === w.id ? 'Закрыть' : 'Редактировать'}
                </button>
              </div>
              {editing === w.id && <EditRow waiter={w} onDone={() => setEditing(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
