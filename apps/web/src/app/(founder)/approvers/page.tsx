import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ApproversManager, type Approver } from './ApproversManager'

export default async function ApproversPage() {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder' && profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()

  const [{ data: rawApprovers }, { data: establishments }] = await Promise.all([
    supabase
      .from('expense_approvers')
      .select('id, name, short_name, is_global, establishment_approvers(establishment_id)')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('establishments')
      .select('id, name')
      .eq('is_active', true)
      .order('name'),
  ])

  const approvers: Approver[] = (rawApprovers ?? []).map(a => ({
    id: a.id,
    name: a.name,
    short_name: a.short_name,
    is_global: a.is_global,
    establishment_ids: ((a.establishment_approvers ?? []) as unknown as { establishment_id: string }[])
      .map(l => l.establishment_id),
  }))

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>Согласующие расходов</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Кто согласует расходы. Глобальные — в любом заведении, остальные — в выбранных.
          </p>
        </div>

        <ApproversManager approvers={approvers} establishments={establishments ?? []} />
      </div>
    </main>
  )
}
