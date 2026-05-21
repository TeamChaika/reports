import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Черновик',
  submitted: 'Отправлен',
  reviewed: 'На проверке',
  approved: 'Утверждён',
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'oklch(65% 0.12 250)',
  submitted: 'oklch(65% 0.18 145)',
  reviewed: 'oklch(65% 0.18 80)',
  approved: 'oklch(65% 0.18 145)',
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return n.toLocaleString('ru') + ' ₽'
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await getUserOrRedirect()
  const supabase = await createClient()

  const { data: report } = await supabase
    .from('daily_reports')
    .select(`
      id, establishment_id, business_date, status,
      cash_start, cash_end, notes,
      revenue_cash, revenue_total, iiko_total, iiko_diff,
      submitted_at,
      establishments(name),
      report_items(pay_type, amount),
      report_expenses(category, description, amount),
      report_prepayments(employee_id, employee_name, amount)
    `)
    .eq('id', id)
    .single()

  if (!report) notFound()

  const expensesTotal = (report.report_expenses ?? []).reduce((s, e) => s + e.amount, 0)
  const prepaymentsTotal = (report.report_prepayments ?? []).reduce((s, p) => s + p.amount, 0)

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Отчёт за {report.business_date}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {(report.establishments as { name?: string } | null)?.name ?? '—'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: STATUS_COLOR[report.status] + '22', color: STATUS_COLOR[report.status] }}
            >
              {STATUS_LABEL[report.status] ?? report.status}
            </span>
            {report.status === 'draft' && (
              <Link
                href={`/reports/${id}/edit`}
                className="text-sm font-medium px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--color-accent)', color: 'white' }}
              >
                Редактировать
              </Link>
            )}
          </div>
        </div>

        {/* Revenue */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Выручка</h2>
          <div className="flex flex-col gap-2">
            {(report.report_items ?? []).map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{item.pay_type}</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{fmt(item.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-1" style={{ borderTop: '1px solid var(--color-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Итого</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-accent)' }}>{fmt(report.revenue_total)}</span>
            </div>
          </div>
        </section>

        {/* iiko reconciliation */}
        {report.iiko_total != null && (
          <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Сверка с iiko</h2>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>iiko выручка</span>
                <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{fmt(report.iiko_total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Расхождение</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: (report.iiko_diff ?? 0) === 0 ? 'oklch(65% 0.18 145)' : 'oklch(60% 0.22 25)' }}
                >
                  {fmt(report.iiko_diff)}
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Cash */}
        <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Касса</h2>
          <div className="grid grid-cols-2 gap-3">
            {[['На начало смены', report.cash_start], ['На конец смены', report.cash_end]].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{fmt(val as number | null)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Expenses */}
        {(report.report_expenses ?? []).length > 0 && (
          <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Расходы — {fmt(expensesTotal)}
            </h2>
            <div className="flex flex-col gap-2">
              {report.report_expenses!.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>{e.category}</p>
                    {e.description && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{e.description}</p>}
                  </div>
                  <span className="text-sm font-medium shrink-0" style={{ color: 'var(--color-text)' }}>{fmt(e.amount)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Prepayments */}
        {(report.report_prepayments ?? []).length > 0 && (
          <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
              Авансы — {fmt(prepaymentsTotal)}
            </h2>
            <div className="flex flex-col gap-2">
              {report.report_prepayments!.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--color-text)' }}>{p.employee_name}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{fmt(p.amount)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Notes */}
        {report.notes && (
          <section className="p-4 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Заметки</h2>
            <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>{report.notes}</p>
          </section>
        )}

        <Link href="/reports" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          ← Все отчёты
        </Link>
      </div>
    </main>
  )
}
