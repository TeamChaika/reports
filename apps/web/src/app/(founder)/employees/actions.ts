'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getProfileOrRedirect } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'

const createEmployeeSchema = z.object({
  full_name: z.string().trim().min(2, 'Имя должно содержать минимум 2 символа').max(200),
  email: z.string().trim().email('Некорректный e-mail').max(254),
  role: z.enum(['manager', 'accountant'], { message: 'Некорректная роль' }),
  establishment_ids: z.array(z.string().uuid()).min(1, 'Выберите хотя бы одно заведение').max(100),
})

async function requireFounder() {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder' && profile.role !== 'admin') {
    redirect('/dashboard')
  }
  return profile
}

export async function createEmployeeAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  await requireFounder()

  const raw = {
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    role: formData.get('role'),
    establishment_ids: formData.getAll('establishment_ids'),
  }

  const parsed = createEmployeeSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { ok: false, error: firstError?.message ?? 'Некорректные данные' }
  }

  const { full_name, email, role, establishment_ids } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc('assign_invited_employee', {
    p_email: email,
    p_full_name: full_name,
    p_role: role,
    p_establishment_ids: establishment_ids,
  })
  if (error) {
    if (error.code === 'P0002') {
      return { ok: false, error: 'Попросите администратора Supabase пригласить сотрудника на этот e-mail' }
    }
    if (error.code === '23505') return { ok: false, error: 'У сотрудника уже есть доступ к отчётам' }
    return { ok: false, error: 'Не удалось выдать доступ к отчётам' }
  }

  revalidatePath('/employees')
  return { ok: true }
}

export async function toggleEmployeeActiveAction(
  userId: string,
  isActive: boolean,
): Promise<void> {
  await setEmployeeActiveAction(userId, isActive)
}

export async function setEmployeeActiveAction(
  userId: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireFounder()

  if (profile.id === userId) {
    return { ok: false, error: 'Нельзя деактивировать собственную учётную запись' }
  }

  const adminClient = createAdminClient()

  const { error } = await adminClient
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId)

  if (error) {
    return { ok: false, error: 'Не удалось изменить статус сотрудника' }
  }

  revalidatePath('/employees')
  return { ok: true }
}
