'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, maybeCleanup } from '@/lib/rate-limit'

const DEFAULT_DOMAIN = '@chaika.team'
const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 60_000

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

  // Rate limit by client IP to slow brute-force attempts
  maybeCleanup()
  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(`login:${ip}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)) {
    redirect('/login?error=ratelimit')
  }

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
