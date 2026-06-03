'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth'

const ALLOWED_ROLES = ['accountant', 'admin', 'founder']

function hasAccess(role: string): boolean {
  return ALLOWED_ROLES.includes(role)
}

export async function createExpenseGroupAction(
  name: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!hasAccess(profile.role)) return { ok: false, error: 'Недостаточно прав' }

  const clean = name.trim()
  if (clean.length < 2) return { ok: false, error: 'Название слишком короткое' }
  if (clean.length > 60) return { ok: false, error: 'Название слишком длинное' }

  const admin = createAdminClient()

  // Next sort order
  const { data: top } = await admin
    .from('expense_groups')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
  const sort_order = (top?.[0]?.sort_order ?? 0) + 1

  const { error } = await admin
    .from('expense_groups')
    .insert({ name: clean, sort_order, is_active: true })

  if (error) {
    if (error.code === '23505' || error.message.includes('duplicate')) {
      return { ok: false, error: 'Категория с таким названием уже есть' }
    }
    return { ok: false, error: 'Не удалось создать категорию' }
  }

  revalidatePath('/expenses')
  return { ok: true }
}

export async function deactivateExpenseGroupAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!hasAccess(profile.role)) return { ok: false, error: 'Недостаточно прав' }

  // Soft delete — keeps historical categorization intact
  const admin = createAdminClient()
  const { error } = await admin
    .from('expense_groups')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { ok: false, error: 'Не удалось убрать категорию' }

  revalidatePath('/expenses')
  return { ok: true }
}
