import Link from 'next/link'
import { getUserOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Черновик',  color: 'oklch(65% 0 0)' },
  submitted: { label: 'Отправлен', color: 'oklch(55% 0.18 250)' },
  reviewed:  { label: 'Проверен',  color: 'oklch(55% 0.15 145)' },
  approved:  { label: 'Принят',    color: 'oklch(45% 0.15 145)' },
}

export default async function ReportsPage() {
  const user = await getUserOrRedirect()
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
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            Отчёты
          </h1>
          <Link
            href="/reports/new"
            className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--color-accent)' }}
          >
            + Новый отчёт
          </Link>
        </div>

        {!reports?.length ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Отчётов пока нет
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {reports.map(r => {
              const status = STATUS_LABEL[r.status] ?? STATUS_LABEL['draft']!
              const estName = (r.establishments as { name?: string } | null)?.name ?? '—'
              return (
                <Link
                  key={r.id}
                  href={r.status === 'draft' ? `/reports/${r.id}/edit` : `/reports/${r.id}`}
                  className="block p-4 rounded-xl transition-colors hover:opacity-90"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-card)' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{estName}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {format(new Date(r.business_date), 'd MMMM yyyy', { locale: ru })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ color: status.color, background: `${status.color}18` }}
                      >
                        {status.label}
                      </p>
                      {r.revenue_total != null && (
                        <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text)' }}>
                          {Number(r.revenue_total).toLocaleString('ru')} ₽
                        </p>
                      )}
                    </div>
                  </div>
                  {r.iiko_diff != null && Math.abs(Number(r.iiko_diff)) > 0 && (
                    <p className="text-xs mt-2" style={{ color: Number(r.iiko_diff) > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      Расхождение с iiko: {Number(r.iiko_diff) > 0 ? '+' : ''}{Number(r.iiko_diff).toLocaleString('ru')} ₽
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
