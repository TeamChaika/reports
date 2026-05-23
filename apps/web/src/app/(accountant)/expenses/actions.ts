'use server'

import { createClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth'

const ALLOWED_ROLES = ['accountant', 'admin', 'founder'] as const

export async function assignCategoryAction(
  expenseId: string,
  groupId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) return { ok: false, error: 'Недостаточно прав' }
  const supabase = await createClient()

  const { error } = await supabase
    .from('report_expenses')
    .update({ group_id: groupId })
    .eq('id', expenseId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function removeCategoryAction(
  expenseId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) return { ok: false, error: 'Недостаточно прав' }
  const supabase = await createClient()

  const { error } = await supabase
    .from('report_expenses')
    .update({ group_id: null })
    .eq('id', expenseId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
