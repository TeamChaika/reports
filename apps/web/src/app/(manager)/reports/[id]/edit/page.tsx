import { notFound, redirect } from 'next/navigation'
import { getUserOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ReportForm } from '@/components/report-form/ReportForm'
import { createDraftAction } from '../../new/actions'
import type { ReportFormValues } from '@shift-reports/shared'

export default async function EditReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getUserOrRedirect()
  const supabase = await createClient()

  const [
    { data: report },
    { data: establishments },
    { data: paymentGroups },
    { data: expenseGroups },
  ] = await Promise.all([
    supabase
      .from('daily_reports')
      .select(`
        id, establishment_id, business_date, status,
        cash_submitted, notes,
        report_items(pay_group_id, pay_group, amount),
        report_expenses(id, name, amount, group_id, approver_name, description, added_by)
      `)
      .eq('id', id)
      .single(),
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
  ])

  if (!report) notFound()
  if (report.status !== 'draft') redirect(`/reports/${id}`)

  // Load approvers available for this establishment
  const { data: approversRaw } = await supabase
    .from('expense_approvers')
    .select('id, name, short_name, is_global, establishment_approvers(establishment_id)')
    .eq('is_active', true)
    .order('name')

  const establishmentId = report.establishment_id
  const approvers = (approversRaw ?? []).filter(
    a => a.is_global || (a.establishment_approvers ?? []).some(
      (ea: { establishment_id: string }) => ea.establishment_id === establishmentId
    )
  ).map(a => ({ id: a.id, name: a.name, short_name: a.short_name }))

  type EstRow = { id: string; name: string; code: string | null; config: Record<string, boolean> }
  const estList: EstRow[] = (establishments ?? [])
    .flatMap(e => (e.establishments ? [e.establishments as unknown as EstRow] : []))

  // Build payGroupAmounts from stored report_items
  const payGroupAmounts: Record<string, number> = Object.fromEntries(
    (paymentGroups ?? []).map(g => [g.id, 0])
  )
  for (const item of report.report_items ?? []) {
    if (item.pay_group_id && item.pay_group_id in payGroupAmounts) {
      payGroupAmounts[item.pay_group_id] = item.amount
    }
  }

  const initialValues: Partial<ReportFormValues> = {
    establishmentId: report.establishment_id,
    businessDate: report.business_date,
    payGroupAmounts,
    cashSubmitted: report.cash_submitted ?? null,
    notes: report.notes ?? '',
  }

  const initialExpenses = (report.report_expenses ?? []).map(e => ({
    id: e.id,
    name: e.name,
    amount: e.amount,
    group_id: e.group_id,
    approver_name: e.approver_name,
    description: e.description,
    added_by: e.added_by,
  }))

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-text)' }}>
          Отчёт за {report.business_date}
        </h1>
        <ReportForm
          establishments={estList}
          paymentGroups={paymentGroups ?? []}
          expenseGroups={expenseGroups ?? []}
          approvers={approvers}
          defaultDate={report.business_date}
          createDraftAction={createDraftAction}
          reportId={id}
          initialValues={initialValues}
          initialExpenses={initialExpenses}
        />
      </div>
    </main>
  )
}
