'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth'

const ALLOWED = ['founder', 'admin']

async function requireAccess() {
  const profile = await getProfileOrRedirect()
  if (!ALLOWED.includes(profile.role)) return null
  return profile
}

export async function createApproverAction(input: {
  name: string
  short_name: string
  is_global: boolean
  establishment_ids: string[]
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAccess())) return { ok: false, error: 'Недостаточно прав' }

  const name = input.name?.trim() ?? ''
  const short = input.short_name?.trim() ?? ''
  if (name.length < 2) return { ok: false, error: 'Укажите ФИО' }
  if (short.length < 1) return { ok: false, error: 'Укажите краткое имя' }
  if (!input.is_global && input.establishment_ids.length === 0) {
    return { ok: false, error: 'Выберите заведения или сделайте глобальным' }
  }

  const admin = createAdminClient()
  const { data: created, error } = await admin
    .from('expense_approvers')
    .insert({ name, short_name: short, is_global: input.is_global, is_active: true })
    .select('id')
    .single()
  if (error || !created) return { ok: false, error: 'Не удалось создать согласующего' }

  if (!input.is_global && input.establishment_ids.length > 0) {
    const { error: linkErr } = await admin
      .from('establishment_approvers')
      .insert(input.establishment_ids.map(eid => ({ approver_id: created.id, establishment_id: eid })))
    if (linkErr) {
      await admin.from('expense_approvers').delete().eq('id', created.id)
      return { ok: false, error: 'Не удалось привязать заведения' }
    }
  }

  revalidatePath('/approvers')
  return { ok: true }
}

export async function setApproverActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAccess())) return { ok: false, error: 'Недостаточно прав' }
  const admin = createAdminClient()
  const { error } = await admin.from('expense_approvers').update({ is_active: isActive }).eq('id', id)
  if (error) return { ok: false, error: 'Не удалось изменить статус' }
  revalidatePath('/approvers')
  return { ok: true }
}

export async function setApproverGlobalAction(
  id: string,
  isGlobal: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAccess())) return { ok: false, error: 'Недостаточно прав' }
  const admin = createAdminClient()
  const { error } = await admin.from('expense_approvers').update({ is_global: isGlobal }).eq('id', id)
  if (error) return { ok: false, error: 'Не удалось изменить' }
  // Global approver doesn't need establishment links
  if (isGlobal) await admin.from('establishment_approvers').delete().eq('approver_id', id)
  revalidatePath('/approvers')
  return { ok: true }
}

export async function setApproverEstablishmentsAction(
  id: string,
  establishmentIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (!(await requireAccess())) return { ok: false, error: 'Недостаточно прав' }
  const admin = createAdminClient()
  // Replace the set of links
  await admin.from('establishment_approvers').delete().eq('approver_id', id)
  if (establishmentIds.length > 0) {
    const { error } = await admin
      .from('establishment_approvers')
      .insert(establishmentIds.map(eid => ({ approver_id: id, establishment_id: eid })))
    if (error) return { ok: false, error: 'Не удалось сохранить заведения' }
  }
  revalidatePath('/approvers')
  return { ok: true }
}
