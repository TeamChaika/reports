'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth'

const ALLOWED_ROLES = ['accountant', 'admin', 'founder'] as const

function hasAccess(role: string): boolean {
  return (ALLOWED_ROLES as readonly string[]).includes(role)
}

export async function assignCategoryAction(
  expenseId: string,
  groupId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!hasAccess(profile.role)) return { ok: false, error: 'Недостаточно прав' }

  // Categorization legitimately spans all establishments, so use the admin
  // client (RLS has no accountant write branch on report_expenses). The action
  // stays the gatekeeper: role checked above, groupId validated below, and only
  // the group_id column is touched.
  const admin = createAdminClient()

  // Validate the target group is a real, active expense group
  const { data: group } = await admin
    .from('expense_groups')
    .select('id')
    .eq('id', groupId)
    .eq('is_active', true)
    .single()
  if (!group) return { ok: false, error: 'Неверная категория' }

  const { error } = await admin
    .from('report_expenses')
    .update({ group_id: groupId })
    .eq('id', expenseId)

  if (error) return { ok: false, error: 'Не удалось присвоить категорию' }
  return { ok: true }
}

export async function removeCategoryAction(
  expenseId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!hasAccess(profile.role)) return { ok: false, error: 'Недостаточно прав' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('report_expenses')
    .update({ group_id: null })
    .eq('id', expenseId)

  if (error) return { ok: false, error: 'Не удалось убрать категорию' }
  return { ok: true }
}
