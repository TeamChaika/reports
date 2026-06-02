'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserOrRedirect } from '@/lib/auth'
import { reportFormSchema, reportDraftPatchSchema, addExpenseSchema } from '@shift-reports/shared'
import type { ReportDraftPatch, AddExpenseValues } from '@shift-reports/shared'

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

  // Scope by report_id as well as id — defence in depth on top of RLS,
  // prevents deleting an expense by guessing its id alone.
  const { error } = await supabase
    .from('report_expenses')
    .delete()
    .eq('id', expenseId)
    .eq('report_id', reportId)

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
