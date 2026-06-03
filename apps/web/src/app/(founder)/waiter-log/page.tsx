import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const ACTION_LABEL: Record<string, string> = { create: 'Создал', update: 'Изменил' }

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function changeSummary(action: string, details: Record<string, unknown>): string {
  if (action === 'create') {
    const parts: string[] = []
    if (details['has_sber']) parts.push('Сбер')
    if (details['has_card']) parts.push('карта')
    return parts.length ? `новый · ${parts.join(', ')}` : 'новый'
  }
  const parts: string[] = []
  if (details['name_changed']) parts.push('имя')
  if (details['sber_changed']) parts.push('Сбер')
  if (details['card_changed']) parts.push('карта')
  if (details['pin_changed']) parts.push('пин')
  return parts.length ? parts.join(', ') : '—'
}

export default async function WaiterLogPage() {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder' && profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()

  const { data: log } = await supabase
    .from('waiter_audit_log')
    .select('id, action, employee_name, details, created_at, establishments(name), profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(300)

  type Row = {
    id: string
    action: string
    employee_name: string
    details: Record<string, unknown>
    created_at: string
    establishments: { name: string } | null
    profiles: { full_name: string | null } | null
  }
  const rows = (log ?? []) as unknown as Row[]

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Журнал официантов</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Кто из менеджеров создавал и редактировал официантов
          </p>
        </div>

        <div className="rounded-xl overflow-x-auto" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: 'var(--space-5)' }}>
          {rows.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Записей пока нет</p>
          ) : (
            <table className="data-table" style={{ minWidth: '640px' }}>
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Действие</th>
                  <th>Официант</th>
                  <th>Заведение</th>
                  <th>Менеджер</th>
                  <th>Что</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{fmtDateTime(r.created_at)}</td>
                    <td>
                      <span className={r.action === 'create' ? 'badge badge-success' : 'badge badge-info'}>
                        {ACTION_LABEL[r.action] ?? r.action}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text)' }}>{r.employee_name}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{r.establishments?.name ?? '—'}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{r.profiles?.full_name ?? '—'}</td>
                    <td style={{ color: 'var(--color-text-disabled)' }}>{changeSummary(r.action, r.details ?? {})}</td>
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
