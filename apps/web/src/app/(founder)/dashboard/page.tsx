import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { DateFilter } from './DateFilter'
import { ReportStatus } from './ReportStatus'
import { RevenueTable, type RevenueRow } from './RevenueTable'
import { ExpenseBreakdown, type ExpenseGroupRow } from './ExpenseBreakdown'
import { AiAnalysis } from './AiAnalysis'
import { AccountingFilesCard, type AccountingFile } from './AccountingFilesCard'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder' && profile.role !== 'admin') {
    redirect('/reports')
  }

  const { from: rawFrom, to: rawTo } = await searchParams
  const today = todayStr()
  const from = rawFrom ?? today
  const to = rawTo ?? today
  const isSingleDay = from === to

  const supabase = await createClient()

  const [{ data: establishments }, { data: reports }, { data: rawExpenseGroups }] =
    await Promise.all([
      supabase
        .from('establishments')
        .select('id, name, iiko_department_id')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('daily_reports')
        .select(`
          id, establishment_id, status, business_date,
          revenue_cash, revenue_card, revenue_other, revenue_total,
          cash_submitted, iiko_total,
          establishments!inner(name)
        `)
        .gte('business_date', from)
        .lte('business_date', to)
        .order('business_date', { ascending: false }),
      supabase
        .from('expense_groups')
        .select('id, name')
        .eq('is_active', true)
        .order('sort_order'),
    ])

  const { data: accountingFiles } = await supabase
    .from('accounting_files')
    .select('id, business_date, type, file_name')
    .gte('business_date', from)
    .lte('business_date', to)
    .order('business_date', { ascending: false })

  // Live iiko revenue (OLAP net) per establishment+date for real-time reconciliation
  const { data: iikoSummary } = await supabase
    .from('iiko_summary_cache')
    .select('department_id, business_date, net')
    .gte('business_date', from)
    .lte('business_date', to)
  const olapNet = new Map<string, number>()
  for (const r of iikoSummary ?? []) {
    const key = `${r.department_id}|${r.business_date}`
    olapNet.set(key, (olapNet.get(key) ?? 0) + Number(r.net))
  }

  type ReportRecord = {
    id: string
    establishment_id: string
    establishment_name: string
    status: string
    business_date: string
    revenue_cash: number
    revenue_card: number
    revenue_other: number
    revenue_total: number
    cash_submitted: number | null
    iiko_total: number | null
  }

  const typedReports: ReportRecord[] = (reports ?? []).map(r => ({
    id: r.id,
    establishment_id: r.establishment_id,
    status: r.status,
    business_date: r.business_date,
    establishment_name: (r.establishments as unknown as { name: string }).name,
    revenue_cash: Number(r.revenue_cash ?? 0),
    revenue_card: Number(r.revenue_card ?? 0),
    revenue_other: Number(r.revenue_other ?? 0),
    revenue_total: Number(r.revenue_total ?? 0),
    cash_submitted: r.cash_submitted != null ? Number(r.cash_submitted) : null,
    iiko_total: r.iiko_total != null ? Number(r.iiko_total) : null,
  }))

  const submittedReports = typedReports.filter(r => r.status !== 'draft')
  const submittedIds = submittedReports.map(r => r.id)

  const { data: expenses } = submittedIds.length > 0
    ? await supabase
        .from('report_expenses')
        .select('report_id, amount, group_id')
        .in('report_id', submittedIds)
    : { data: [] }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalRevenue = submittedReports.reduce((s, r) => s + r.revenue_total, 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)

  // ── Establishment status grid ─────────────────────────────────────────────
  const establishmentStatus = (establishments ?? []).map(est => {
    const estReports = typedReports.filter(r => r.establishment_id === est.id)
    const latestReport = estReports.find(r => r.status !== 'draft') ?? estReports[0] ?? null
    return {
      id: est.id,
      name: est.name,
      hasReport: estReports.length > 0,
      status: latestReport?.status ?? null,
      reportCount: estReports.filter(r => r.status !== 'draft').length,
    }
  })

  // ── Revenue by establishment ──────────────────────────────────────────────
  const revenueRows: RevenueRow[] = (establishments ?? [])
    .map(est => {
      const estReports = submittedReports.filter(r => r.establishment_id === est.id)
      if (estReports.length === 0) return null
      // Live iiko revenue from OLAP net, matched to the report dates
      const deptId = (est as { iiko_department_id: string | null }).iiko_department_id
      let iikoSum = 0
      let iikoAvailable = false
      for (const r of estReports) {
        const key = `${deptId}|${r.business_date}`
        if (olapNet.has(key)) {
          iikoSum += olapNet.get(key)!
          iikoAvailable = true
        }
      }
      return {
        id: est.id,
        name: est.name,
        cash: estReports.reduce((s, r) => s + r.revenue_cash, 0),
        card: estReports.reduce((s, r) => s + r.revenue_card, 0),
        other: estReports.reduce((s, r) => s + r.revenue_other, 0),
        total: estReports.reduce((s, r) => s + r.revenue_total, 0),
        iikoTotal: iikoAvailable ? iikoSum : null,
        iikoAvailable,
        cashSubmitted: estReports.some(r => r.cash_submitted !== null)
          ? estReports.reduce((s, r) => s + (r.cash_submitted ?? 0), 0)
          : null,
      }
    })
    .filter((r): r is RevenueRow => r !== null)

  // ── Expense breakdown by category ─────────────────────────────────────────
  const expenseGroups: ExpenseGroupRow[] = (rawExpenseGroups ?? [])
    .map(g => {
      const grouped = (expenses ?? []).filter(e => e.group_id === g.id)
      return {
        id: g.id,
        name: g.name,
        total: grouped.reduce((s, e) => s + Number(e.amount), 0),
        count: grouped.length,
      }
    })
    .filter(g => g.total > 0)

  const uncategorized = (expenses ?? []).filter(e => !e.group_id)
  const uncategorizedTotal = uncategorized.reduce((s, e) => s + Number(e.amount), 0)

  // ── Date label ────────────────────────────────────────────────────────────
  const dateLabel = isSingleDay
    ? new Date(from + 'T12:00:00').toLocaleDateString('ru', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : `${from} — ${to}`

  const kpis = [
    {
      label: 'Выручка',
      value: totalRevenue.toLocaleString('ru') + ' ₽',
      color: 'var(--color-text)',
    },
    {
      label: 'Расходы',
      value: totalExpenses.toLocaleString('ru') + ' ₽',
      color: 'var(--color-danger)',
    },
    {
      label: 'Чистая',
      value: (totalRevenue - totalExpenses).toLocaleString('ru') + ' ₽',
      color: 'var(--color-success)',
    },
    {
      label: 'Отчётов',
      value: String(submittedReports.length),
      color: 'var(--color-text)',
    },
  ]

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Дашборд
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {dateLabel}
            </p>
          </div>
          <DateFilter from={from} to={to} />
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, color }) => (
            <div
              key={label}
              className="px-5 py-4 rounded-xl"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p className="text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                {label}
              </p>
              <p className="text-2xl font-bold" style={{ color }}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Report status */}
        <ReportStatus establishments={establishmentStatus} isSingleDay={isSingleDay} />

        {/* Revenue table */}
        {revenueRows.length > 0 ? (
          <RevenueTable rows={revenueRows} />
        ) : (
          <div
            className="p-10 text-center rounded-xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              За выбранный период нет отправленных отчётов
            </p>
          </div>
        )}

        {/* Expense breakdown */}
        {(expenseGroups.length > 0 || uncategorizedTotal > 0) && (
          <ExpenseBreakdown
            groups={expenseGroups}
            uncategorizedTotal={uncategorizedTotal}
            uncategorizedCount={uncategorized.length}
            total={totalExpenses}
          />
        )}

        {/* Accounting files (3rd source) */}
        <AccountingFilesCard files={(accountingFiles ?? []) as AccountingFile[]} />

        {/* AI analysis combining all three sources */}
        <AiAnalysis from={from} to={to} />

      </div>
    </main>
  )
}
