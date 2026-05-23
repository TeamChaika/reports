export type ExpenseGroupRow = {
  id: string
  name: string
  total: number
  count: number
}

function fmt(n: number) {
  return n.toLocaleString('ru')
}

export function ExpenseBreakdown({
  groups,
  uncategorizedTotal,
  uncategorizedCount,
  total,
}: {
  groups: ExpenseGroupRow[]
  uncategorizedTotal: number
  uncategorizedCount: number
  total: number
}) {
  type Row = ExpenseGroupRow & { isUncategorized?: boolean }

  const rows: Row[] = [
    ...groups.sort((a, b) => b.total - a.total),
    ...(uncategorizedTotal > 0
      ? [{ id: '__none', name: 'Без категории', total: uncategorizedTotal, count: uncategorizedCount, isUncategorized: true }]
      : []),
  ]

  if (rows.length === 0) return null

  const maxTotal = Math.max(...rows.map(r => r.total), 1)

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)' }}
    >
      <div
        className="px-5 py-3 flex items-baseline gap-3"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold text-text">
          Расходы по категориям
        </h2>
        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-danger)' }}>
          {fmt(total)} ₽
        </span>
      </div>

      <div
        className="flex flex-col gap-3"
        style={{ background: 'var(--color-bg)', padding: 'var(--space-5)' }}
      >
        {rows.map(row => {
          const barPct = (row.total / maxTotal) * 100
          const sharePct = total > 0 ? (row.total / total) * 100 : 0
          const isUncategorized = !!row.isUncategorized

          return (
            <div key={row.id} className="flex items-center gap-4">
              {/* Category name */}
              <div
                className="text-xs shrink-0 w-40 truncate"
                style={{ color: isUncategorized ? 'var(--color-warning)' : 'var(--color-text)' }}
                title={row.name}
              >
                {row.name}
              </div>

              {/* Bar track */}
              <div
                className="flex-1 rounded-md overflow-hidden flex items-center"
                style={{
                  height: 'var(--space-5)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${barPct}%`,
                    background: isUncategorized
                      ? 'var(--color-warning)'
                      : 'var(--color-accent)',
                    opacity: 0.65,
                    transition: 'width var(--duration-slow) var(--ease-out-expo)',
                  }}
                />
              </div>

              {/* Amount */}
              <div
                className="text-xs tabular-nums font-medium text-right shrink-0 w-24 text-text"
              >
                {fmt(row.total)} ₽
              </div>

              {/* Share % */}
              <div
                className="text-xs tabular-nums text-right shrink-0 w-10 text-text-muted"
              >
                {sharePct.toFixed(0)}%
              </div>

              {/* Count */}
              <div
                className="text-xs tabular-nums text-right shrink-0 w-16 text-text-muted"
              >
                {row.count} поз.
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
