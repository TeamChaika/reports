export type RevenueRow = {
  id: string
  name: string
  cash: number
  card: number
  other: number
  total: number
  iikoTotal: number | null
  iikoAvailable: boolean
  cashSubmitted: number | null
}

function fmt(n: number) {
  return n.toLocaleString('ru')
}

function diffColor(diff: number) {
  const abs = Math.abs(diff)
  if (abs < 500) return 'var(--color-text-muted)'
  return diff > 0 ? 'var(--color-success)' : 'var(--color-danger)'
}

function fmtDiff(diff: number | null, available: boolean) {
  if (!available) return '—'
  if (diff === null) return '—'
  if (diff === 0) return '0'
  return (diff > 0 ? '+' : '') + fmt(Math.round(diff))
}

// Shared column classes using design token utilities
const COL = 'px-4 py-3 text-right tabular-nums text-sm'
const COL_HEAD = 'px-4 py-2.5 text-xs font-medium text-right uppercase tracking-widest'

export function RevenueTable({ rows }: { rows: RevenueRow[] }) {
  if (rows.length === 0) return null

  const hasIiko = rows.some(r => r.iikoAvailable)
  const hasCashSubmitted = rows.some(r => r.cashSubmitted !== null)

  const totals = {
    cash: rows.reduce((s, r) => s + r.cash, 0),
    card: rows.reduce((s, r) => s + r.card, 0),
    other: rows.reduce((s, r) => s + r.other, 0),
    total: rows.reduce((s, r) => s + r.total, 0),
    iikoTotal: hasIiko ? rows.reduce((s, r) => s + (r.iikoTotal ?? 0), 0) : null,
    iikoDiff: hasIiko ? rows.reduce((s, r) => {
      if (!r.iikoAvailable || r.iikoTotal === null) return s
      return s + (r.total - r.iikoTotal)
    }, 0) : null,
    cashSubmitted: hasCashSubmitted ? rows.reduce((s, r) => s + (r.cashSubmitted ?? 0), 0) : null,
  }

  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--color-border)' }}
    >
      <div
        className="px-5 py-3"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold text-text">
          Выручка по заведениям
        </h2>
      </div>

      <div style={{ background: 'var(--color-bg)', overflowX: 'auto' }}>
        <table className="w-full min-w-[600px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th
                className="px-4 py-2.5 text-xs font-medium text-left uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Заведение
              </th>
              {(['Наличные', 'Безнал.', 'Прочие', 'Итого'] as const).map(col => (
                <th key={col} className={COL_HEAD} style={{ color: 'var(--color-text-muted)' }}>
                  {col}
                </th>
              ))}
              {hasIiko && (
                <>
                  <th className={COL_HEAD} style={{ color: 'var(--color-text-muted)' }}>iiko</th>
                  <th className={COL_HEAD} style={{ color: 'var(--color-text-muted)' }}>Расхожд.</th>
                </>
              )}
              {hasCashSubmitted && (
                <th className={COL_HEAD} style={{ color: 'var(--color-text-muted)' }}>Сдано</th>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, i) => {
              const diff = row.iikoAvailable && row.iikoTotal !== null
                ? row.total - row.iikoTotal
                : null
              return (
                <tr
                  key={row.id}
                  className="table-row-hover"
                  style={{ borderTop: i > 0 ? '1px solid var(--color-border-subtle)' : undefined }}
                >
                  <td
                    className="px-4 py-3 text-sm font-medium text-text"
                  >
                    {row.name}
                  </td>
                  <td className={COL} style={{ color: 'var(--color-text-muted)' }}>
                    {row.cash > 0 ? fmt(row.cash) : '—'}
                  </td>
                  <td className={COL} style={{ color: 'var(--color-text-muted)' }}>
                    {row.card > 0 ? fmt(row.card) : '—'}
                  </td>
                  <td className={COL} style={{ color: 'var(--color-text-muted)' }}>
                    {row.other > 0 ? fmt(row.other) : '—'}
                  </td>
                  <td className={`${COL} font-semibold text-text`}>
                    {fmt(row.total)}
                  </td>
                  {hasIiko && (
                    <>
                      <td className={COL} style={{ color: 'var(--color-text-muted)' }}>
                        {row.iikoAvailable && row.iikoTotal !== null ? fmt(row.iikoTotal) : '—'}
                      </td>
                      <td
                        className={`${COL} font-medium`}
                        style={{ color: diff !== null ? diffColor(diff) : 'var(--color-text-muted)' }}
                      >
                        {fmtDiff(diff, row.iikoAvailable)}
                      </td>
                    </>
                  )}
                  {hasCashSubmitted && (
                    <td className={COL} style={{ color: 'var(--color-text-muted)' }}>
                      {row.cashSubmitted !== null ? fmt(row.cashSubmitted) : '—'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            <tr
              style={{
                borderTop: '2px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              <td
                className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-text-muted"
              >
                Итого
              </td>
              <td className={`${COL} font-semibold text-text`}>
                {fmt(totals.cash)}
              </td>
              <td className={`${COL} font-semibold text-text`}>
                {fmt(totals.card)}
              </td>
              <td className={`${COL} font-semibold text-text`}>
                {fmt(totals.other)}
              </td>
              <td
                className={`${COL} font-bold text-base`}
                style={{ color: 'var(--color-accent)' }}
              >
                {fmt(totals.total)}
              </td>
              {hasIiko && (
                <>
                  <td className={`${COL} font-semibold text-text`}>
                    {totals.iikoTotal !== null ? fmt(totals.iikoTotal) : '—'}
                  </td>
                  <td
                    className={`${COL} font-semibold`}
                    style={{
                      color: totals.iikoDiff !== null
                        ? diffColor(totals.iikoDiff)
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {fmtDiff(totals.iikoDiff, hasIiko)}
                  </td>
                </>
              )}
              {hasCashSubmitted && (
                <td className={`${COL} font-semibold text-text`}>
                  {totals.cashSubmitted !== null ? fmt(totals.cashSubmitted) : '—'}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
