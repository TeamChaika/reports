'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function confirmInvitation(formData: FormData): Promise<void> {
  const tokenHash = formData.get('token_hash')
  if (typeof tokenHash !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(tokenHash)) {
    redirect('/auth/confirm?error=invalid')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
  if (error) redirect('/auth/confirm?error=invalid')
  redirect('/change-password')
}
