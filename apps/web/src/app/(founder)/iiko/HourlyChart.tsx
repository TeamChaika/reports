'use client'

import { fmtNum } from '@/lib/format'
import { useState } from 'react'

type HourPoint = { hour: number; revenue: number; orders: number }

export function HourlyChart({ data }: { data: HourPoint[] }) {
  const [active, setActive] = useState<number | null>(null)

  // Trim to the active window: first..last hour with any revenue
  const activeBars = data.filter(d => d.revenue > 0)
  if (activeBars.length === 0) {
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

  const firstHour = Math.min(...activeBars.map(d => d.hour))
  const lastHour = Math.max(...activeBars.map(d => d.hour))
  const window = data.filter(d => d.hour >= firstHour && d.hour <= lastHour)
  const maxRevenue = Math.max(...window.map(d => d.revenue), 1)
  const total = window.reduce((s, d) => s + d.revenue, 0)

  return (
    <div
      className="rounded-xl"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Динамика по часам
        </h2>
        <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
          наведите для суммы
        </span>
      </div>

      <div className="flex items-end gap-1" style={{ height: '180px' }}>
        {window.map(d => {
          const isActive = active === d.hour
          const heightPct = (d.revenue / maxRevenue) * 100
          const sharePct = total > 0 ? (d.revenue / total) * 100 : 0
          return (
            <div
              key={d.hour}
              className="flex-1 flex flex-col items-center justify-end gap-1"
              style={{ height: '100%', position: 'relative', cursor: 'pointer' }}
              onMouseEnter={() => setActive(d.hour)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive(a => (a === d.hour ? null : d.hour))}
            >
              {/* Label: % of revenue by default, ₽ amount when active (hover/click) */}
              {isActive ? (
                <div
                  className="tabular-nums font-medium"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    background: 'var(--color-surface-raised)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '2px 6px',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 1,
                    fontSize: '11px',
                    color: 'var(--color-text)',
                  }}
                >
                  {fmtNum(d.revenue)} ₽ · {d.orders} чек.
                </div>
              ) : (
                <span
                  className="tabular-nums"
                  style={{ fontSize: '9px', color: 'var(--color-text-disabled)', marginBottom: '2px' }}
                >
                  {d.revenue > 0 ? `${sharePct.toFixed(0)}%` : ''}
                </span>
              )}

              <div
                style={{
                  width: '100%',
                  height: `${Math.max(heightPct, d.revenue > 0 ? 2 : 0)}%`,
                  background: isActive ? 'var(--color-accent-hover)' : 'var(--color-accent)',
                  borderRadius: 'var(--radius-xs) var(--radius-xs) 0 0',
                  transition: 'background var(--duration-fast), height var(--duration-normal) var(--ease-out-expo)',
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
