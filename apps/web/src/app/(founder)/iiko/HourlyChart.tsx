type HourPoint = { hour: number; revenue: number; orders: number }

export function HourlyChart({ data }: { data: HourPoint[] }) {
  // Trim to the active window: first..last hour with any revenue
  const active = data.filter(d => d.revenue > 0)
  if (active.length === 0) {
    return (
      <div
        className="rounded-xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
          Динамика по часам
        </h2>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Нет данных за период</p>
      </div>
    )
  }

  const firstHour = Math.min(...active.map(d => d.hour))
  const lastHour = Math.max(...active.map(d => d.hour))
  const window = data.filter(d => d.hour >= firstHour && d.hour <= lastHour)
  const maxRevenue = Math.max(...window.map(d => d.revenue), 1)

  return (
    <div
      className="rounded-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}
    >
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
        Динамика по часам
      </h2>
      <div className="flex items-end gap-1" style={{ height: '160px' }}>
        {window.map(d => {
          const heightPct = (d.revenue / maxRevenue) * 100
          return (
            <div
              key={d.hour}
              className="flex-1 flex flex-col items-center justify-end gap-1"
              style={{ height: '100%' }}
              title={`${d.hour}:00 — ${Math.round(d.revenue).toLocaleString('ru')} ₽ · ${d.orders} чек.`}
            >
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(heightPct, d.revenue > 0 ? 2 : 0)}%`,
                  background: 'var(--color-accent)',
                  borderRadius: 'var(--radius-xs) var(--radius-xs) 0 0',
                  transition: 'height var(--duration-normal) var(--ease-out-expo)',
                  minHeight: d.revenue > 0 ? '3px' : '0',
                }}
              />
              <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-text-disabled)' }}>
                {d.hour}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
