'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getProfileOrRedirect } from '@/lib/auth'

const BUCKET = 'accounting-reports'
const ALLOWED_ROLES = ['accountant', 'admin', 'founder'] as const
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function uploadAccountingFileAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) return { ok: false, error: 'Недостаточно прав' }

  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null
  const businessDate = formData.get('businessDate') as string | null

  if (!file || !type || !businessDate) return { ok: false, error: 'Не заполнены обязательные поля' }
  if (!['nal', 'bn'].includes(type)) return { ok: false, error: 'Неверный тип файла' }
  if (!DATE_RE.test(businessDate)) return { ok: false, error: 'Неверный формат даты' }
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: 'Файл слишком большой (макс. 10 МБ)' }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['xlsx', 'xls'].includes(ext ?? '')) return { ok: false, error: 'Только xlsx/xls файлы' }

  // Supabase Storage requires ASCII-only object keys.
  // Replace spaces with underscores, then strip any remaining non-ASCII / non-URL-safe characters.
  const safeFileName = file.name
    .replace(/\s+/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E]/g, '')   // drop non-ASCII
    .replace(/[^a-zA-Z0-9._\-]/g, '_') // keep only safe ASCII chars
    .replace(/_{2,}/g, '_')            // collapse consecutive underscores
    || `file_${Date.now()}`
  const storagePath = `${type}/${businessDate}/${Date.now()}_${safeFileName}`
  const bytes = await file.arrayBuffer()

  // Use admin client for all operations — user is already verified via getUserOrRedirect().
  // The regular session client can fail RLS when cookies aren't forwarded through
  // the useTransition / server-action boundary in all deployment environments.
  const admin = createAdminClient()

  // Remove existing file for this date+type if present
  const { data: existing } = await admin
    .from('accounting_files')
    .select('id, storage_path')
    .eq('business_date', businessDate)
    .eq('type', type)
    .single()

  if (existing) {
    await admin.storage.from(BUCKET).remove([existing.storage_path])
    await admin.from('accounting_files').delete().eq('id', existing.id)
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    })

  if (uploadError) return { ok: false, error: uploadError.message }

  const { error: dbError } = await admin.from('accounting_files').insert({
    business_date: businessDate,
    type,
    file_name: file.name,
    storage_path: storagePath,
    uploaded_by: profile.id,
  })

  if (dbError) {
    await admin.storage.from(BUCKET).remove([storagePath])
    return { ok: false, error: dbError.message }
  }

  revalidatePath('/expenses')
  return { ok: true }
}

export async function getDownloadUrlAction(
  fileId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) return { ok: false, error: 'Недостаточно прав' }
  const admin = createAdminClient()

  const { data: file } = await admin
    .from('accounting_files')
    .select('storage_path, file_name')
    .eq('id', fileId)
    .single()

  if (!file) return { ok: false, error: 'Файл не найден' }

  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 60)

  if (error || !data) return { ok: false, error: error?.message ?? 'Ошибка создания ссылки' }
  return { ok: true, url: data.signedUrl }
}

export async function deleteAccountingFileAction(
  fileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfileOrRedirect()
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) return { ok: false, error: 'Недостаточно прав' }
  const admin = createAdminClient()

  const { data: file } = await admin
    .from('accounting_files')
    .select('storage_path')
    .eq('id', fileId)
    .single()

  if (!file) return { ok: false, error: 'Файл не найден' }

  await admin.storage.from(BUCKET).remove([file.storage_path])

  const { error } = await admin.from('accounting_files').delete().eq('id', fileId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/expenses')
  return { ok: true }
}
