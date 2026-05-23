'use client'

import { useRouter } from 'next/navigation'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const PRESETS = [
  { label: 'Сегодня', from: () => todayStr(), to: () => todayStr() },
  { label: 'Вчера', from: () => daysAgo(1), to: () => daysAgo(1) },
  { label: '7 дней', from: () => daysAgo(6), to: () => todayStr() },
  { label: 'Месяц', from: firstOfMonth, to: () => todayStr() },
]

export function DateFilter({ from, to }: { from: string; to: string }) {
  const router = useRouter()
  const apply = (f: string, t: string) => router.push(`/dashboard?from=${f}&to=${t}`)

  const activePreset = PRESETS.findIndex(p => p.from() === from && p.to() === to)

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <div
        className="flex gap-1 rounded-lg"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          padding: 'var(--space-1)',
        }}
      >
        {PRESETS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => apply(p.from(), p.to())}
            className={activePreset === i ? 'btn btn-secondary btn--sm' : 'btn btn-ghost btn--sm'}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        value={from === to ? from : ''}
        onChange={e => { if (e.target.value) apply(e.target.value, e.target.value) }}
        className="input input--sm"
        style={{ width: 'auto' }}
      />
    </div>
  )
}
