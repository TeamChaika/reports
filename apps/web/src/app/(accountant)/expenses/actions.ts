'use server'

import { createClient } from '@/lib/supabase/server'
import { getUserOrRedirect } from '@/lib/auth'

export async function assignCategoryAction(
  expenseId: string,
  groupId: string,
): Promise<{ ok: boolean; error?: string }> {
  await getUserOrRedirect()
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
  await getUserOrRedirect()
  const supabase = await createClient()

  const { error } = await supabase
    .from('report_expenses')
    .update({ group_id: null })
    .eq('id', expenseId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
