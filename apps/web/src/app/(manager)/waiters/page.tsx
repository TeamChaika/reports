import { getUserOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { WaiterForm } from './WaiterForm'

export default async function WaitersPage() {
  const user = await getUserOrRedirect()
  const supabase = await createClient()

  // Manager's establishments
  const { data: links } = await supabase
    .from('establishment_users')
    .select('establishments(id, name, iiko_department_id)')
    .eq('user_id', user.id)

  type Est = { id: string; name: string; iiko_department_id: string | null }
  const establishments: Est[] = (links ?? [])
    .flatMap(l => (l.establishments ? [l.establishments as unknown as Est] : []))

  // Department codes for those establishments → list existing OP1 waiters
  const deptIds = establishments.map(e => e.iiko_department_id).filter(Boolean) as string[]
  const { data: depts } = deptIds.length > 0
    ? await supabase.from('iiko_departments').select('id, code').in('id', deptIds)
    : { data: [] }
  const codes = (depts ?? []).map(d => String(d.code)).filter(Boolean)

  const { data: waiters } = codes.length > 0
    ? await supabase
        .from('iiko_employees')
        .select('id, name, code, department_codes')
        .eq('main_role_code', 'OP1')
        .eq('deleted', false)
        .in('department_codes', codes)
        .order('name')
        .limit(300)
    : { data: [] }

  const codeToEst = new Map<string, string>()
  for (const d of depts ?? []) {
    const est = establishments.find(e => e.iiko_department_id === d.id)
    if (est) codeToEst.set(String(d.code), est.name)
  }

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">

        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Официанты</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Создание официантов (OP1) в iiko для ваших заведений
          </p>
        </div>

        <WaiterForm establishments={establishments.map(e => ({ id: e.id, name: e.name }))} />

        <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
            Официанты заведений
            <span className="text-xs ml-1.5" style={{ color: 'var(--color-text-disabled)' }}>{(waiters ?? []).length}</span>
          </h2>
          {(waiters ?? []).length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Официантов пока нет</p>
          ) : (
            <table className="data-table" style={{ minWidth: '360px' }}>
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Таб. №</th>
                  <th>Заведение</th>
                </tr>
              </thead>
              <tbody>
                {(waiters ?? []).map(w => (
                  <tr key={w.id}>
                    <td style={{ color: 'var(--color-text)' }}>{w.name}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{w.code ?? '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{codeToEst.get(String(w.department_codes)) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </main>
  )
}
