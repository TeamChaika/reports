import { getUserOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ReportForm } from '@/components/report-form/ReportForm'
import { createDraftAction } from './actions'
import { format, subDays } from 'date-fns'

export default async function NewReportPage() {
  const user = await getUserOrRedirect()
  const supabase = await createClient()

  const [
    { data: establishments },
    { data: paymentGroups },
    { data: expenseGroups },
    { data: approvers },
  ] = await Promise.all([
    supabase
      .from('establishment_users')
      .select('establishments(id, name, code, config)')
      .eq('user_id', user.id),
    supabase
      .from('payment_groups')
      .select('id, name, code')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('expense_groups')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('expense_approvers')
      .select('id, name, short_name')
      .eq('is_active', true)
      .order('name'),
  ])

  type EstRow = { id: string; name: string; code: string | null; config: Record<string, boolean> }
  const estList: EstRow[] = (establishments ?? [])
    .flatMap(e => (e.establishments ? [e.establishments as unknown as EstRow] : []))

  const today = format(subDays(new Date(), 1), 'yyyy-MM-dd')

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text)' }}>
          Новый отчёт
        </h1>
        <ReportForm
          establishments={estList}
          paymentGroups={paymentGroups ?? []}
          expenseGroups={expenseGroups ?? []}
          approvers={approvers ?? []}
          defaultDate={today}
          createDraftAction={createDraftAction}
        />
      </div>
    </main>
  )
}
