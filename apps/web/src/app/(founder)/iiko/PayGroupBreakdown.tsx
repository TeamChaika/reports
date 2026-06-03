'use client'

import { fmtNum } from '@/lib/format'
import { useState } from 'react'

export type PayGroup = {
  code: string
  name: string
  total: number
  types: { name: string; total: number }[]
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div style={{ height: '6px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg)' }}>
      <div
        style={{
          width: `${(value / max) * 100}%`,
          height: '100%',
          borderRadius: 'var(--radius-full)',
          background: color,
        }}
      />
    </div>
  )
}

function GroupRow({ group, max }: { group: PayGroup; max: number }) {
  const [open, setOpen] = useState(false)
  const expandable = group.types.length > 1
  const maxType = Math.max(...group.types.map(t => t.total), 1)

  return (
    <div>
      <button
        type="button"
        onClick={() => expandable && setOpen(o => !o)}
        className="w-full text-left"
        style={{ cursor: expandable ? 'pointer' : 'default' }}
        aria-expanded={open}
      >
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-sm flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
            {expandable && (
              <span
                style={{
                  display: 'inline-block',
                  transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform var(--duration-fast)',
                  color: 'var(--color-text-disabled)',
                  fontSize: '10px',
                }}
                aria-hidden="true"
              >
                ▶
              </span>
            )}
            {group.name}
            {expandable && (
              <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>
                {group.types.length}
              </span>
            )}
          </span>
          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text)' }}>
            {fmtNum(group.total)} ₽
          </span>
        </div>
        <Bar value={group.total} max={max} color="var(--color-accent)" />
      </button>

      {open && (
        <div className="flex flex-col gap-2 mt-2 pl-4">
          {group.types.map(t => (
            <div key={t.name}>
              <div className="flex items-center justify-between mb-0.5 gap-2">
                <span className="text-xs truncate-1" style={{ color: 'var(--color-text-muted)' }}>{t.name}</span>
                <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                  {fmtNum(t.total)} ₽
                </span>
              </div>
              <Bar value={t.total} max={maxType} color="var(--color-accent-subtle)" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function PayGroupBreakdown({ groups, max }: { groups: PayGroup[]; max: number }) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map(g => (
        <GroupRow key={g.code} group={g} max={max} />
      ))}
    </div>
  )
}
