type EstablishmentStatus = {
  id: string
  name: string
  hasReport: boolean
  status: string | null
  reportCount: number
}

const STATUS_MAP: Record<string, { label: string; bg: string; color: string; border: string }> = {
  draft: {
    label: 'Черновик',
    bg: 'oklch(92% 0 0)',
    color: 'oklch(40% 0 0)',
    border: 'oklch(75% 0 0)',
  },
  submitted: {
    label: 'Отправлен',
    bg: 'oklch(93% 0.06 250)',
    color: 'oklch(45% 0.18 250)',
    border: 'oklch(75% 0.12 250)',
  },
  reviewed: {
    label: 'Проверен',
    bg: 'oklch(93% 0.07 75)',
    color: 'oklch(48% 0.17 75)',
    border: 'oklch(78% 0.12 75)',
  },
  approved: {
    label: 'Принят',
    bg: 'oklch(93% 0.07 145)',
    color: 'oklch(42% 0.15 145)',
    border: 'oklch(75% 0.12 145)',
  },
}

const MISSING = {
  label: 'Не сдан',
  bg: 'oklch(93% 0.04 25)',
  color: 'oklch(45% 0.15 25)',
  border: 'oklch(78% 0.1 25)',
}

export function ReportStatus({
  establishments,
  isSingleDay,
}: {
  establishments: EstablishmentStatus[]
  isSingleDay: boolean
}) {
  const withReport = establishments.filter(e => e.hasReport && e.status !== 'draft')
  const withoutReport = establishments.filter(e => !e.hasReport || e.status === 'draft')

  return (
    <section
      className="rounded-xl"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div
        className="px-5 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Статус отчётов
        </h2>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {withReport.length} из {establishments.length} заведений сдали отчёт
        </span>
      </div>

      <div className="p-4 flex flex-wrap gap-2">
        {establishments.map(est => {
          const info = (est.status && est.status !== 'draft' ? STATUS_MAP[est.status] : null) ?? MISSING

          return (
            <div
              key={est.id}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
              style={{ background: info.bg, border: `1px solid ${info.border}` }}
            >
              <span style={{ color: info.color }}>{est.name}</span>
              <span
                className="px-1.5 py-0.5 rounded text-xs"
                style={{
                  background: 'rgba(0,0,0,0.06)',
                  color: info.color,
                  opacity: 0.85,
                }}
              >
                {!isSingleDay && est.reportCount > 1
                  ? `${est.reportCount} отч.`
                  : info.label}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
