'use client'

import { useState, useTransition } from 'react'
import { createExpenseGroupAction, deactivateExpenseGroupAction } from './categoryActions'

export type Category = { id: string; name: string }

export function ExpenseCategories({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function add() {
    setError('')
    const value = name.trim()
    if (value.length < 2) { setError('Название слишком короткое'); return }
    startTransition(async () => {
      const result = await createExpenseGroupAction(value)
      if (result.ok) setName('')
      else setError(result.error ?? 'Ошибка')
    })
  }

  function remove(id: string) {
    startTransition(async () => {
      await deactivateExpenseGroupAction(id)
    })
  }

  return (
    <div
      className="rounded-xl mb-6"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3"
        style={{ cursor: 'pointer' }}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Категории расходов
          <span className="text-xs ml-1.5" style={{ color: 'var(--color-text-disabled)' }}>
            {categories.length}
          </span>
        </span>
        <span
          style={{
            display: 'inline-block',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--duration-fast)',
            color: 'var(--color-text-disabled)',
            fontSize: '11px',
          }}
          aria-hidden="true"
        >
          ▶
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--color-border)' }}>
          {/* Add form */}
          <div className="flex gap-2 mt-4 mb-4">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') add() }}
              placeholder="Новая категория (напр. «Доставка»)"
              className="input input--sm"
              maxLength={60}
            />
            <button
              type="button"
              onClick={add}
              disabled={isPending}
              className="btn btn-primary btn--sm shrink-0"
            >
              + Добавить
            </button>
          </div>
          {error && (
            <p className="text-xs mb-3" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}

          {/* Existing categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 text-sm rounded-lg"
                style={{
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border-subtle)',
                  padding: '4px 6px 4px 10px',
                  color: 'var(--color-text)',
                }}
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  disabled={isPending}
                  aria-label={`Убрать категорию ${c.name}`}
                  className="flex items-center justify-center rounded"
                  style={{
                    width: '18px', height: '18px',
                    color: 'var(--color-text-disabled)',
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                  title="Убрать категорию"
                >
                  ✕
                </button>
              </span>
            ))}
            {categories.length === 0 && (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Категорий пока нет</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
