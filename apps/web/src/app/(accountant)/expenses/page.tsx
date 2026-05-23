import { getUserOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ExpenseTable } from './ExpenseTable'
import { AccountingFiles } from './AccountingFiles'

export default async function ExpenseCategoriesPage() {
  await getUserOrRedirect()
  const supabase = await createClient()

  const [{ data: expenses }, { data: expenseGroups }, { data: accountingFiles }] = await Promise.all([
    supabase
      .from('report_expenses')
      .select(`
        id, name, amount, approver_name, group_id, created_at, report_id,
        daily_reports!inner(
          business_date, status,
          establishments(name)
        )
      `)
      .in('daily_reports.status', ['submitted', 'reviewed', 'approved'])
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('expense_groups')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('accounting_files')
      .select('id, business_date, type, file_name, created_at')
      .order('business_date', { ascending: false })
      .limit(90),
  ])

  const uncategorized = (expenses ?? []).filter(e => !e.group_id).length
  const totalAmount = (expenses ?? []).reduce((s, e) => s + e.amount, 0)

  type ExpenseRow = {
    id: string
    name: string
    amount: number
    approver_name: string | null
    group_id: string | null
    created_at: string
    report_id: string
    report: { business_date: string; establishment: { name: string } | null }
  }

  const rows: ExpenseRow[] = (expenses ?? []).map(e => ({
    id: e.id,
    name: e.name,
    amount: e.amount,
    approver_name: e.approver_name,
    group_id: e.group_id,
    created_at: e.created_at,
    report_id: e.report_id,
    report: {
      business_date: (e.daily_reports as unknown as { business_date: string }).business_date,
      establishment: (e.daily_reports as unknown as { establishments: { name: string } | null }).establishments,
    },
  }))

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Категоризация расходов
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Назначьте категорию каждому расходу из отправленных отчётов
            </p>
          </div>
          {/* Summary chips */}
          <div className="flex gap-2 shrink-0">
            <div
              className="text-center px-4 py-2 rounded-lg"
              style={{ background: 'oklch(65% 0.18 60 / 12%)', border: '1px solid oklch(65% 0.18 60 / 30%)' }}
            >
              <p className="text-xl font-bold" style={{ color: 'oklch(50% 0.18 60)' }}>{uncategorized}</p>
              <p className="text-xs" style={{ color: 'oklch(50% 0.18 60)' }}>без категории</p>
            </div>
            <div
              className="text-center px-4 py-2 rounded-lg"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
                {totalAmount.toLocaleString('ru')} ₽
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>итого расходов</p>
            </div>
          </div>
        </div>

        <ExpenseTable expenses={rows} expenseGroups={expenseGroups ?? []} />

        <AccountingFiles
          files={(accountingFiles ?? []) as {
            id: string
            business_date: string
            type: 'nal' | 'bn'
            file_name: string
            created_at: string
          }[]}
        />
      </div>
    </main>
  )
}
