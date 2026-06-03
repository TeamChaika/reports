'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth'

const ALLOWED_ROLES = ['accountant', 'admin', 'founder']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type Allocation = { establishment_id: string; amount: number }

export type CreateExpenseInput = {
  expense_date: string
  name: string
  group_id: string | null
  payment_type: 'cash' | 'noncash'
  total_amount: number
  note?: string
  allocations: Allocation[]
}

export async function createAccountingExpenseAction(
  input: CreateExpenseInput,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!ALLOWED_ROLES.includes(profile.role)) return { ok: false, error: 'Недостаточно прав' }

  const name = input.name?.trim() ?? ''
  if (name.length < 2) return { ok: false, error: 'Укажите название' }
  if (!DATE_RE.test(input.expense_date)) return { ok: false, error: 'Неверная дата' }
  if (!['cash', 'noncash'].includes(input.payment_type)) return { ok: false, error: 'Неверный тип оплаты' }

  const total = Number(input.total_amount)
  if (!(total > 0)) return { ok: false, error: 'Сумма должна быть больше 0' }

  const allocations = (input.allocations ?? []).filter(a => a.establishment_id && Number(a.amount) > 0)
  if (allocations.length === 0) return { ok: false, error: 'Выберите хотя бы одно заведение' }

  // Allocations must sum to the total (allow 1₽ rounding tolerance)
  const allocSum = allocations.reduce((s, a) => s + Number(a.amount), 0)
  if (Math.abs(allocSum - total) > 1) {
    return { ok: false, error: `Сумма распределения (${Math.round(allocSum)}) не равна итогу (${Math.round(total)})` }
  }

  const admin = createAdminClient()

  // Validate group (if provided) and establishments exist
  if (input.group_id) {
    const { data: g } = await admin.from('expense_groups').select('id').eq('id', input.group_id).single()
    if (!g) return { ok: false, error: 'Неверная категория' }
  }
  const estIds = [...new Set(allocations.map(a => a.establishment_id))]
  const { data: ests } = await admin.from('establishments').select('id').in('id', estIds)
  if ((ests?.length ?? 0) !== estIds.length) return { ok: false, error: 'Неверное заведение' }

  const { data: created, error } = await admin
    .from('accounting_expenses')
    .insert({
      expense_date: input.expense_date,
      name,
      group_id: input.group_id,
      payment_type: input.payment_type,
      total_amount: total,
      note: input.note?.trim() || null,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (error || !created) return { ok: false, error: 'Не удалось создать расход' }

  const { error: allocError } = await admin
    .from('accounting_expense_allocations')
    .insert(allocations.map(a => ({
      expense_id: created.id,
      establishment_id: a.establishment_id,
      amount: Number(a.amount),
    })))

  if (allocError) {
    await admin.from('accounting_expenses').delete().eq('id', created.id)
    return { ok: false, error: 'Не удалось сохранить распределение' }
  }

  revalidatePath('/accounting-expenses')
  return { ok: true }
}

export async function deleteAccountingExpenseAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!ALLOWED_ROLES.includes(profile.role)) return { ok: false, error: 'Недостаточно прав' }

  const admin = createAdminClient()
  const { error } = await admin.from('accounting_expenses').delete().eq('id', id)
  if (error) return { ok: false, error: 'Не удалось удалить' }

  revalidatePath('/accounting-expenses')
  return { ok: true }
}
