import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

export async function getUser() {
  const supabase = await createClient()
  // getUser() validates with the auth server — safe for Server Actions
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getUserOrRedirect() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  return data
}

export async function getProfileOrRedirect() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (!profile.is_active) redirect('/login?error=inactive')
  return profile
}
