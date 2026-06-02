'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getUserOrRedirect } from '@/lib/auth'

export async function changeMyPasswordAction(formData: FormData) {
  const password = (formData.get('password') as string)?.trim()
  const confirm = (formData.get('confirm') as string)?.trim()

  if (!password || password.length < 8) redirect('/change-password?error=short')
  if (password !== confirm) redirect('/change-password?error=mismatch')

  const user = await getUserOrRedirect()
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect('/change-password?error=failed')

  // Clear the must_change_password flag
  const admin = createAdminClient()
  await admin.from('profiles').update({ must_change_password: false }).eq('id', user.id)

  redirect('/reports')
}
