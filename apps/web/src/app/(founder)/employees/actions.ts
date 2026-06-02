'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getProfileOrRedirect } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

const createEmployeeSchema = z.object({
  full_name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  email: z.string().email('Некорректный e-mail'),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
  role: z.enum(['manager', 'accountant'], { message: 'Некорректная роль' }),
  establishment_ids: z.array(z.string().uuid()).min(1, 'Выберите хотя бы одно заведение'),
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
  const profile = await requireFounder()
  void profile

  const raw = {
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
    establishment_ids: formData.getAll('establishment_ids'),
  }

  const parsed = createEmployeeSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.errors[0]
    return { ok: false, error: firstError?.message ?? 'Некорректные данные' }
  }

  const { full_name, email, password, role, establishment_ids } = parsed.data

  const adminClient = createAdminClient()

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    const msg = authError?.message ?? 'Не удалось создать пользователя'
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return { ok: false, error: 'Пользователь с таким e-mail уже существует' }
    }
    return { ok: false, error: msg }
  }

  const userId = authData.user.id

  const { error: profileError } = await adminClient
    .from('profiles')
    .upsert({ id: userId, full_name, role, is_active: true })

  if (profileError) {
    await adminClient.auth.admin.deleteUser(userId)
    return { ok: false, error: 'Не удалось создать профиль сотрудника' }
  }

  const { error: estError } = await adminClient
    .from('establishment_users')
    .insert(establishment_ids.map(eid => ({ user_id: userId, establishment_id: eid })))

  if (estError) {
    await adminClient.from('profiles').delete().eq('id', userId)
    await adminClient.auth.admin.deleteUser(userId)
    return { ok: false, error: 'Не удалось привязать сотрудника к заведению' }
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
