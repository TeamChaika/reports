type EstablishmentStatus = {
  id: string
  name: string
  hasReport: boolean
  status: string | null
  reportCount: number
}

// Map report statuses to semantic badge classes from the design system
const STATUS_BADGE_CLASS: Record<string, string> = {
  submitted: 'badge badge-info',
  reviewed:  'badge badge-warning',
  approved:  'badge badge-success',
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Отправлен',
  reviewed:  'Проверен',
  approved:  'Принят',
}

const MISSING_BADGE_CLASS = 'badge badge-danger'
const MISSING_LABEL = 'Не сдан'

export function ReportStatus({
  establishments,
  isSingleDay,
}: {
  establishments: EstablishmentStatus[]
  isSingleDay: boolean
}) {
  const withReport = establishments.filter(e => e.hasReport && e.status !== 'draft')

  return (
    <section
      className="rounded-xl"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold text-text">
          Статус отчётов
        </h2>
        <span className="text-xs text-text-muted">
          {withReport.length} из {establishments.length} заведений сдали отчёт
        </span>
      </div>

      <div className="p-4 flex flex-wrap gap-2">
        {establishments.map(est => {
          const isMissing = !est.hasReport || est.status === 'draft'
          const badgeClass = isMissing
            ? MISSING_BADGE_CLASS
            : (STATUS_BADGE_CLASS[est.status ?? ''] ?? 'badge badge-neutral')
          const label = isMissing
            ? MISSING_LABEL
            : (STATUS_LABEL[est.status ?? ''] ?? est.status ?? '—')

          return (
            <div
              key={est.id}
              className={`${badgeClass} transition-colors`}
              style={{ height: 'auto', padding: 'var(--space-1-5) var(--space-3)', borderRadius: 'var(--radius-md)' }}
            >
              <span>{est.name}</span>
              <span
                className="ml-1.5 opacity-80 text-xs"
              >
                {!isSingleDay && est.reportCount > 1
                  ? `${est.reportCount} отч.`
                  : label}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
