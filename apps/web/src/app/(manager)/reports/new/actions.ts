'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserOrRedirect } from '@/lib/auth'
import { reportFormSchema, reportDraftPatchSchema, addExpenseSchema } from '@shift-reports/shared'
import type { ReportDraftPatch, AddExpenseValues } from '@shift-reports/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

function resolveGroupCode(payTypeName: string): string | null {
  const s = payTypeName.toLowerCase()
  if (s.includes('без оплаты')) return null
  if (s.includes('наличн')) return 'cash'
  if (s.includes('карт') || s.includes('безнал')) return 'card'
  if (s.includes('кальян')) return 'hookah'
  if (s.includes('онлайн') || s.includes('сайт') || s.includes('доставк')) return 'online'
  return 'other'
}

async function prefillRevenueFromIiko(
  supabase: SupabaseClient,
  reportId: string,
  establishmentId: string,
  businessDate: string,
) {
  // Get establishment's iiko_department_id
  const { data: est } = await supabase
    .from('establishments')
    .select('iiko_department_id')
    .eq('id', establishmentId)
    .single()
  if (!est?.iiko_department_id) return

  // Fetch OLAP rows for this department and date
  const { data: olapRows } = await supabase
    .from('iiko_olap_cache')
    .select('pay_type, dish_sum')
    .eq('department_id', est.iiko_department_id)
    .eq('business_date', businessDate)
  if (!olapRows || olapRows.length === 0) return

  // Load payment groups
  const { data: groups } = await supabase
    .from('payment_groups')
    .select('id, name, code, maps_to')
    .eq('is_active', true)
  if (!groups || groups.length === 0) return

  const groupByCode = new Map(groups.map(g => [g.code, g]))

  // Aggregate by group code
  const sums = new Map<string, number>()
  for (const row of olapRows) {
    const code = resolveGroupCode(row.pay_type ?? '')
    if (!code) continue
    sums.set(code, (sums.get(code) ?? 0) + Number(row.dish_sum))
  }
  if (sums.size === 0) return

  // Compute revenue totals
  let revenue_cash = 0, revenue_card = 0, revenue_other = 0
  for (const [code, amount] of sums) {
    const g = groupByCode.get(code)
    if (!g) continue
    if (g.maps_to === 'cash') revenue_cash += amount
    else if (g.maps_to === 'card') revenue_card += amount
    else revenue_other += amount
  }

  // Update report revenue
  await supabase
    .from('daily_reports')
    .update({ revenue_cash, revenue_card, revenue_other })
    .eq('id', reportId)

  // Replace report_items
  await supabase.from('report_items').delete().eq('report_id', reportId)
  const items = []
  for (const [code, amount] of sums) {
    if (amount <= 0) continue
    const g = groupByCode.get(code)
    if (!g) continue
    items.push({ report_id: reportId, pay_group: g.name, pay_group_id: g.id, amount })
  }
  if (items.length > 0) await supabase.from('report_items').insert(items)
}

export async function createDraftAction(establishmentId: string, businessDate: string) {
  const user = await getUserOrRedirect()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('daily_reports')
    .upsert(
      {
        establishment_id: establishmentId,
        business_date: businessDate,
        status: 'draft',
        source: 'web',
        submitted_by: user.id,
      },
      { onConflict: 'establishment_id,business_date', ignoreDuplicates: false },
    )
    .select('id')
    .single()

  if (error || !data) throw new Error('Не удалось создать отчёт')

  // Pre-fill revenue from iiko OLAP cache for this establishment and date
  await prefillRevenueFromIiko(supabase, data.id, establishmentId, businessDate)

  redirect(`/reports/${data.id}/edit`)
}

export async function saveDraftAction(
  reportId: string,
  patch: ReportDraftPatch,
): Promise<{ ok: boolean; error?: string }> {
  await getUserOrRedirect()

  const parsed = reportDraftPatchSchema.safeParse(patch)
  if (!parsed.success) return { ok: false, error: 'Неверный формат данных' }

  const data = parsed.data
  const supabase = await createClient()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.cashSubmitted !== undefined) updates['cash_submitted'] = data.cashSubmitted
  if (data.notes !== undefined) updates['notes'] = data.notes

  // Compute revenue totals and replace report_items from payment group amounts
  if (data.payGroupAmounts) {
    const groupIds = Object.keys(data.payGroupAmounts)
    const { data: groups } = await supabase
      .from('payment_groups')
      .select('id, name, maps_to')
      .in('id', groupIds)

    const mapsTo = Object.fromEntries((groups ?? []).map(g => [g.id, g.maps_to]))
    const groupNames = Object.fromEntries((groups ?? []).map(g => [g.id, g.name]))
    let revenueCash = 0, revenueCard = 0, revenueOther = 0

    for (const [id, amount] of Object.entries(data.payGroupAmounts)) {
      const target = mapsTo[id] ?? 'other'
      if (target === 'cash') revenueCash += amount
      else if (target === 'card') revenueCard += amount
      else revenueOther += amount
    }

    updates['revenue_cash'] = revenueCash
    updates['revenue_card'] = revenueCard
    updates['revenue_other'] = revenueOther

    const { error: updateError } = await supabase
      .from('daily_reports')
      .update(updates)
      .eq('id', reportId)
      .eq('status', 'draft')

    if (updateError) return { ok: false, error: 'Ошибка сохранения' }

    const { error: deleteError } = await supabase.from('report_items').delete().eq('report_id', reportId)
    if (deleteError) return { ok: false, error: 'Ошибка сохранения позиций' }

    const items = Object.entries(data.payGroupAmounts)
      .filter(([, amount]) => amount > 0)
      .map(([pay_group_id, amount]) => ({ report_id: reportId, pay_group_id, pay_group: groupNames[pay_group_id] ?? '', amount }))

    if (items.length > 0) {
      const { error: insertError } = await supabase.from('report_items').insert(items)
      if (insertError) return { ok: false, error: 'Ошибка сохранения позиций' }
    }
    return { ok: true }
  }

  const { error: updateError } = await supabase
    .from('daily_reports')
    .update(updates)
    .eq('id', reportId)
    .eq('status', 'draft')

  if (updateError) return { ok: false, error: 'Ошибка сохранения' }

  return { ok: true }
}

export async function addExpenseAction(
  reportId: string,
  expense: AddExpenseValues,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const user = await getUserOrRedirect()

  const parsed = addExpenseSchema.safeParse(expense)
  if (!parsed.success) return { ok: false, error: 'Неверный формат данных' }

  const data = parsed.data
  const supabase = await createClient()

  const { data: row, error } = await supabase
    .from('report_expenses')
    .insert({
      report_id: reportId,
      name: data.name,
      group_id: data.groupId,
      amount: data.amount,
      approver_id: data.approverId ?? null,
      approver_name: data.approverName ?? null,
      description: data.description ?? null,
      added_by: user.id,
    })
    .select('id')
    .single()

  if (error || !row) return { ok: false, error: 'Не удалось добавить расход' }
  revalidatePath(`/reports/${reportId}/edit`)
  return { ok: true, id: row.id }
}

export async function removeExpenseAction(
  expenseId: string,
  reportId: string,
): Promise<{ ok: boolean; error?: string }> {
  await getUserOrRedirect()
  const supabase = await createClient()

  const { error } = await supabase
    .from('report_expenses')
    .delete()
    .eq('id', expenseId)

  if (error) return { ok: false, error: 'Не удалось удалить расход' }
  revalidatePath(`/reports/${reportId}/edit`)
  return { ok: true }
}

export async function submitReportAction(
  reportId: string,
  values: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUserOrRedirect()

  const parsed = reportFormSchema.safeParse(values)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { ok: false, error: firstError?.message ?? 'Заполните все обязательные поля' }
  }

  await saveDraftAction(reportId, parsed.data)

  const supabase = await createClient()
  const { error } = await supabase
    .from('daily_reports')
    .update({
      status: 'submitted',
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', reportId)
    .eq('status', 'draft')

  if (error) return { ok: false, error: 'Не удалось отправить отчёт' }
  return { ok: true }
}
