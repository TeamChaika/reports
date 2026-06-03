'use client'

import { useState, useTransition } from 'react'
import { createWaiterAction } from './actions'

type Est = { id: string; name: string }

export function WaiterForm({ establishments }: { establishments: Est[] }) {
  const [name, setName] = useState('')
  const [sber, setSber] = useState('')
  const [card, setCard] = useState('')
  const [pin, setPin] = useState('')
  const [establishmentId, setEstablishmentId] = useState(establishments.length === 1 ? establishments[0]!.id : '')
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(''); setOk(false)
    if (name.trim().length < 2) { setError('Укажите имя'); return }
    if (!/^\d{4,6}$/.test(pin.trim())) { setError('Пин-код — 4–6 цифр'); return }
    if (!establishmentId) { setError('Выберите заведение'); return }
    startTransition(async () => {
      const result = await createWaiterAction({
        name: name.trim(),
        sberTipsId: sber.trim() || undefined,
        cardNumber: card.trim() || undefined,
        pinCode: pin.trim(),
        establishmentId,
      })
      if (result.ok) {
        setOk(true)
        setName(''); setSber(''); setCard(''); setPin('')
      } else {
        setError(result.error ?? 'Ошибка')
      }
    })
  }

  return (
    <div className="rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Новый официант (OP1)</h2>

      <div className="flex flex-col gap-3">
        <div className="form-group">
          <label className="label text-xs text-text-muted">Имя в системе *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Напр. «Иванов Иван»" className="input input--sm" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="form-group">
            <label className="label text-xs text-text-muted">Пин-код *</label>
            <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="4–6 цифр" className="input input--sm input--number" />
          </div>
          <div className="form-group">
            <label className="label text-xs text-text-muted">Номер карты</label>
            <input value={card} onChange={e => setCard(e.target.value)} placeholder="необязательно" className="input input--sm" />
          </div>
        </div>

        <div className="form-group">
          <label className="label text-xs text-text-muted">Идентификатор Сбер Чаевых</label>
          <input value={sber} onChange={e => setSber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="напр. 10004389402332" className="input input--sm input--number" />
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-disabled)' }}>
            {sber ? `Имя в iiko: ${name || '…'}_${sber}` : 'Если указать — добавится в конец имени для QR на пречеке'}
          </p>
        </div>

        <div className="form-group">
          <label className="label text-xs text-text-muted">Заведение *</label>
          <select value={establishmentId} onChange={e => setEstablishmentId(e.target.value)} className="input input--sm input--select">
            <option value="">— выберите —</option>
            {establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        {error && <p className="text-xs" style={{ color: 'var(--color-danger)' }}>{error}</p>}
        {ok && <p className="text-xs" style={{ color: 'var(--color-success)' }}>Официант создан в iiko ✓</p>}

        <button type="button" onClick={submit} disabled={isPending} className="btn btn-primary mt-1">
          {isPending ? 'Создаю в iiko…' : 'Создать официанта'}
        </button>
      </div>
    </div>
  )
}
