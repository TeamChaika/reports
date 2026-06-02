'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfileOrRedirect } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/server'

async function requireFounder() {
  const profile = await getProfileOrRedirect()
  if (profile.role !== 'founder' && profile.role !== 'admin') redirect('/dashboard')
  return profile
}

export async function setEstablishmentActiveAction(
  establishmentId: string,
  isActive: boolean,
): Promise<void> {
  await requireFounder()
  const adminClient = createAdminClient()
  await adminClient
    .from('establishments')
    .update({ is_active: isActive })
    .eq('id', establishmentId)
  revalidatePath('/establishments')
}
