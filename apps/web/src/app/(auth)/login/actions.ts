'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_DOMAIN = '@chaika.team'

function resolveEmail(input: string): string {
  const trimmed = input.trim()
  if (trimmed.includes('@')) return trimmed
  // Normalize phone: strip leading +7 or 8, keep only digits
  const digits = trimmed.replace(/\D/g, '')
  const normalized = digits.startsWith('7') ? digits : digits.startsWith('8') ? '7' + digits.slice(1) : digits
  return normalized + DEFAULT_DOMAIN
}

export async function loginAction(formData: FormData) {
  const raw = formData.get('login') as string
  const password = formData.get('password') as string

  if (!raw || !password) redirect('/login?error=missing')

  const email = resolveEmail(raw)
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=invalid')
  }

  redirect('/reports')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
