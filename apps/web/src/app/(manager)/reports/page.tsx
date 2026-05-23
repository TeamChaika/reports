import Link from 'next/link'
import { getUserOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const STATUS_BADGE: Record<string, string> = {
  draft:     'badge badge-neutral',
  submitted: 'badge badge-info',
  reviewed:  'badge badge-warning',
  approved:  'badge badge-success',
}

const STATUS_LABEL: Record<string, string> = {
  draft:     'Черновик',
  submitted: 'Отправлен',
  reviewed:  'Проверен',
  approved:  'Принят',
}

export default async function ReportsPage() {
  await getUserOrRedirect()
  const supabase = await createClient()

  const { data: reports } = await supabase
    .from('daily_reports')
    .select(`
      id, business_date, status, revenue_total, iiko_diff, submitted_at, updated_at,
      establishments(name)
    `)
    .order('business_date', { ascending: false })
    .limit(50)

  return (
    <main className="min-h-screen bg-bg">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-text">
            Отчёты
          </h1>
          <Link
            href="/reports/new"
            className="btn btn-primary"
          >
            + Новый отчёт
          </Link>
        </div>

        {!reports?.length ? (
          <p className="text-sm text-text-muted">
            Отчётов пока нет
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map(r => {
              const badgeClass = STATUS_BADGE[r.status] ?? STATUS_BADGE['draft']!
              const statusLabel = STATUS_LABEL[r.status] ?? STATUS_LABEL['draft']!
              const estName = (r.establishments as { name?: string } | null)?.name ?? '—'
              return (
                <Link
                  key={r.id}
                  href={r.status === 'draft' ? `/reports/${r.id}/edit` : `/reports/${r.id}`}
                  className="card card--interactive block"
                  style={{ padding: 'var(--space-4)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-text">{estName}</p>
                      <p className="text-xs mt-0.5 text-text-muted">
                        {format(new Date(r.business_date), 'd MMMM yyyy', { locale: ru })}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1.5">
                      <span className={badgeClass}>{statusLabel}</span>
                      {r.revenue_total != null && (
                        <p
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: 'var(--color-text)' }}
                        >
                          {Number(r.revenue_total).toLocaleString('ru')} ₽
                        </p>
                      )}
                    </div>
                  </div>
                  {r.iiko_diff != null && Math.abs(Number(r.iiko_diff)) > 0 && (
                    <p
                      className="text-xs mt-2 tabular-nums"
                      style={{
                        color: Number(r.iiko_diff) > 0
                          ? 'var(--color-success)'
                          : 'var(--color-danger)',
                      }}
                    >
                      Расхождение с iiko: {Number(r.iiko_diff) > 0 ? '+' : ''}
                      {Number(r.iiko_diff).toLocaleString('ru')} ₽
                    </p>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
