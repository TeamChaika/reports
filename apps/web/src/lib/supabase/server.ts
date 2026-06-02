import 'server-only'
import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from Server Component — cookie mutation is expected to fail
          }
        },
      },
    },
  )
}

// Service-role client for Server Actions — bypasses RLS.
// Uses createClient from @supabase/supabase-js (not @supabase/ssr) so that
// the service_role JWT is sent as-is, which Supabase recognises as a bypass
// for Row Level Security.  @supabase/ssr's createServerClient wraps auth in
// a cookie session layer that can cause the role to resolve as anon instead
// of service_role, triggering RLS violations on insert/delete.
export function createAdminClient() {
  return createSupabaseClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
