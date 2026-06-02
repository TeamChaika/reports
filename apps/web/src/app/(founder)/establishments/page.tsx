import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { setEstablishmentActiveAction } from './actions'

export default async function EstablishmentsPage() {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder' && profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: establishments } = await supabase
    .from('establishments')
    .select('id, name, code, is_active')
    .order('name')

  const rows = establishments ?? []
  const active = rows.filter(e => e.is_active)
  const inactive = rows.filter(e => !e.is_active)

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            Заведения
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {active.length} активных · {inactive.length} неактивных
          </p>
        </div>

        <EstablishmentTable rows={rows} />
      </div>
    </main>
  )
}

type Row = { id: string; name: string; code: string | null; is_active: boolean }

function EstablishmentTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Заведений нет
      </p>
    )
  }

  return (
    <div
      className="rounded-xl overflow-x-auto"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div>
        <table className="data-table" style={{ minWidth: '480px' }}>
          <thead>
            <tr>
              <th>Название</th>
              <th>Код</th>
              <th>Статус</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(est => {
              const toggle = setEstablishmentActiveAction.bind(null, est.id, !est.is_active)
              return (
                <tr key={est.id} style={est.is_active ? undefined : { opacity: 0.5 }}>
                  <td>
                    <span className="font-medium" style={{ color: 'var(--color-text)' }}>
                      {est.name}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {est.code ?? '—'}
                    </span>
                  </td>
                  <td>
                    {est.is_active
                      ? <span className="badge badge-success">Активно</span>
                      : <span className="badge badge-neutral">Неактивно</span>
                    }
                  </td>
                  <td>
                    <form action={toggle}>
                      <button
                        type="submit"
                        className={`btn btn--sm ${est.is_active ? 'btn-danger' : 'btn-success'}`}
                      >
                        {est.is_active ? 'Деактивировать' : 'Активировать'}
                      </button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
