import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AccountingExpenseForm } from './AccountingExpenseForm'
import { AccountingExpensesList, type ExpenseItem } from './AccountingExpensesList'

const ALLOWED = ['accountant', 'admin', 'founder']

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default async function AccountingExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const profile = await getProfileOrRedirect()
  if (!ALLOWED.includes(profile.role)) redirect('/reports')

  const { from: rawFrom, to: rawTo } = await searchParams
  const from = rawFrom ?? firstOfMonth()
  const to = rawTo ?? todayStr()

  const supabase = await createClient()

  const [{ data: establishments }, { data: groups }, { data: expenses }] = await Promise.all([
    supabase.from('establishments').select('id, name').eq('is_active', true).order('name'),
    supabase.from('expense_groups').select('id, name').eq('is_active', true).order('sort_order'),
    supabase
      .from('accounting_expenses')
      .select(`
        id, expense_date, name, payment_type, total_amount, group_id,
        accounting_expense_allocations(amount, establishments(name))
      `)
      .eq('is_deleted', false)
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: false }),
  ])

  const groupName = new Map((groups ?? []).map(g => [g.id as string, g.name as string]))

  const items: ExpenseItem[] = (expenses ?? []).map(e => ({
    id: e.id,
    expense_date: e.expense_date,
    name: e.name,
    category: e.group_id ? (groupName.get(e.group_id) ?? '—') : 'Без категории',
    payment_type: e.payment_type as 'cash' | 'noncash',
    total_amount: Number(e.total_amount),
    allocations: ((e.accounting_expense_allocations ?? []) as unknown as { amount: number; establishments: { name: string } | null }[])
      .map(a => ({ establishment: a.establishments?.name ?? '—', amount: Number(a.amount) })),
  }))

  const total = items.reduce((s, e) => s + e.total_amount, 0)
  const cashTotal = items.filter(e => e.payment_type === 'cash').reduce((s, e) => s + e.total_amount, 0)
  const noncashTotal = total - cashTotal

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6">

        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            Расходы бухгалтерии
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Расходы нал/безнал с распределением по заведениям · {from} — {to}
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Итого', value: total, color: 'var(--color-text)' },
            { label: 'Наличные', value: cashTotal, color: 'var(--color-text-muted)' },
            { label: 'Безнал', value: noncashTotal, color: 'var(--color-text-muted)' },
          ].map(k => (
            <div key={k.label} className="px-4 py-3 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{k.label}</p>
              <p className="text-lg font-bold tabular-nums" style={{ color: k.color }}>{Math.round(k.value).toLocaleString('ru')} ₽</p>
            </div>
          ))}
        </div>

        <AccountingExpenseForm establishments={establishments ?? []} groups={groups ?? []} />

        <AccountingExpensesList items={items} />

      </div>
    </main>
  )
}
