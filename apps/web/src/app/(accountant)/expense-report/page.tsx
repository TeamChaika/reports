import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ExpenseReportFilters } from './ExpenseReportFilters'
import { ExportXlsxButton, type DetailRow } from './ExportXlsxButton'

const ALLOWED = ['accountant', 'admin', 'founder']

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; est?: string }>
}) {
  const profile = await getProfileOrRedirect()
  if (!ALLOWED.includes(profile.role)) redirect('/reports')

  const { from: rawFrom, to: rawTo, est = '' } = await searchParams
  const from = rawFrom ?? firstOfMonth()
  const to = rawTo ?? todayStr()

  const supabase = await createClient()

  const [{ data: establishments }, { data: expenseGroups }] = await Promise.all([
    supabase.from('establishments').select('id, name').eq('is_active', true).order('name'),
    supabase.from('expense_groups').select('id, name').eq('is_active', true).order('sort_order'),
  ])
  const groupName = new Map((expenseGroups ?? []).map(g => [g.id as string, g.name as string]))

  let query = supabase
    .from('report_expenses')
    .select(`
      id, name, amount, approver_name, group_id,
      daily_reports!inner(business_date, status, establishment_id, establishments(name))
    `)
    .in('daily_reports.status', ['submitted', 'reviewed', 'approved'])
    .gte('daily_reports.business_date', from)
    .lte('daily_reports.business_date', to)
  if (est) query = query.eq('daily_reports.establishment_id', est)

  const { data: expensesRaw } = await query

  type ExpRow = {
    id: string
    name: string
    amount: number
    approver_name: string | null
    group_id: string | null
    daily_reports: { business_date: string; establishments: { name: string } | null }
  }
  const expenses = (expensesRaw ?? []) as unknown as ExpRow[]

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  // By category
  const catMap = new Map<string, { total: number; count: number }>()
  for (const e of expenses) {
    const key = e.group_id ? (groupName.get(e.group_id) ?? '—') : 'Без категории'
    const c = catMap.get(key) ?? { total: 0, count: 0 }
    c.total += Number(e.amount)
    c.count += 1
    catMap.set(key, c)
  }
  const byCategory = [...catMap.entries()]
    .map(([name, v]) => ({ name, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)

  // By establishment
  const estMap = new Map<string, { total: number; count: number }>()
  for (const e of expenses) {
    const key = e.daily_reports?.establishments?.name ?? '—'
    const c = estMap.get(key) ?? { total: 0, count: 0 }
    c.total += Number(e.amount)
    c.count += 1
    estMap.set(key, c)
  }
  const byEstablishment = [...estMap.entries()]
    .map(([name, v]) => ({ name, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)

  // Detail list
  const details: DetailRow[] = expenses
    .map(e => ({
      date: e.daily_reports?.business_date ?? '',
      establishment: e.daily_reports?.establishments?.name ?? '—',
      name: e.name,
      category: e.group_id ? (groupName.get(e.group_id) ?? '—') : 'Без категории',
      approver: e.approver_name ?? '—',
      amount: Number(e.amount),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  const selectedEst = (establishments ?? []).find(e => e.id === est)
  const maxCat = Math.max(...byCategory.map(c => c.total), 1)

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Отчёт по расходам
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {from} — {to}{selectedEst ? ` · ${selectedEst.name}` : ''}
            </p>
          </div>
          <ExpenseReportFilters from={from} to={to} est={est} establishments={establishments ?? []} />
        </div>

        {/* Summary + export */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-3">
            <div className="px-5 py-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Итого расходов</p>
              <p className="text-xl font-bold" style={{ color: 'var(--color-danger)' }}>{Math.round(total).toLocaleString('ru')} ₽</p>
            </div>
            <div className="px-5 py-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>Записей</p>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>{details.length}</p>
            </div>
          </div>
          {details.length > 0 && (
            <ExportXlsxButton
              from={from} to={to} total={total}
              byCategory={byCategory} byEstablishment={byEstablishment} details={details}
            />
          )}
        </div>

        {details.length === 0 ? (
          <div className="p-10 text-center rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>За период расходов нет</p>
          </div>
        ) : (
          <>
            {/* By category */}
            <div className="rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>По категориям</h2>
              <div className="flex flex-col gap-3">
                {byCategory.map(c => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1 gap-3">
                      <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                        {c.name} <span className="text-xs" style={{ color: 'var(--color-text-disabled)' }}>· {c.count}</span>
                      </span>
                      <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text)' }}>
                        {Math.round(c.total).toLocaleString('ru')} ₽
                        <span className="text-xs ml-1.5" style={{ color: 'var(--color-text-disabled)' }}>
                          {Math.round((c.total / total) * 100)}%
                        </span>
                      </span>
                    </div>
                    <div style={{ height: '5px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg)' }}>
                      <div style={{ width: `${(c.total / maxCat) * 100}%`, height: '100%', borderRadius: 'var(--radius-full)', background: 'var(--color-danger)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By establishment */}
            <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>По заведениям</h2>
              <table className="data-table" style={{ minWidth: '320px' }}>
                <thead>
                  <tr>
                    <th>Заведение</th>
                    <th style={{ textAlign: 'right' }}>Сумма</th>
                    <th style={{ textAlign: 'right' }}>Записей</th>
                  </tr>
                </thead>
                <tbody>
                  {byEstablishment.map(e => (
                    <tr key={e.name}>
                      <td style={{ color: 'var(--color-text)' }}>{e.name}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--color-text)' }}>{Math.round(e.total).toLocaleString('ru')} ₽</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--color-text-muted)' }}>{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detail list */}
            <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>Детализация</h2>
              <table className="data-table" style={{ minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Заведение</th>
                    <th>Расход</th>
                    <th>Категория</th>
                    <th style={{ textAlign: 'right' }}>Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, i) => (
                    <tr key={i}>
                      <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{d.date}</td>
                      <td style={{ color: 'var(--color-text-muted)' }}>{d.establishment}</td>
                      <td style={{ color: 'var(--color-text)' }}>{d.name}</td>
                      <td style={{ color: d.category === 'Без категории' ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>{d.category}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--color-text)' }}>{Math.round(d.amount).toLocaleString('ru')} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    </main>
  )
}
