import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Hostname → allowed path prefixes + post-auth redirect
const DOMAIN_CONFIG: Record<string, { allowed: string[]; home: string }> = {
  'reports.chaika.team': {
    allowed: ['/reports', '/login', '/auth'],
    home: '/reports',
  },
  'office.chaika.team': {
    allowed: ['/expenses', '/login', '/auth'],
    home: '/expenses',
  },
  'dashboard.chaika.team': {
    allowed: ['/dashboard', '/employees', '/establishments', '/login', '/auth'],
    home: '/dashboard',
  },
}

function getDomainConfig(hostname: string) {
  // Strip port for local dev (e.g. localhost:3000)
  const host = hostname.split(':')[0] ?? hostname
  return DOMAIN_CONFIG[host] ?? null
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refresh session — required for SSR auth to work correctly
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/auth')

  if (!user && !isAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const domainCfg = getDomainConfig(request.nextUrl.hostname)

  if (user && isAuth) {
    const url = request.nextUrl.clone()
    // Redirect to the domain's home, or /reports as fallback
    url.pathname = domainCfg?.home ?? '/reports'
    return NextResponse.redirect(url)
  }

  // Enforce domain isolation: redirect to domain home if accessing wrong path
  if (domainCfg && !domainCfg.allowed.some(p => pathname.startsWith(p))) {
    const url = request.nextUrl.clone()
    url.pathname = domainCfg.home
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|api/|mini-app).*)'],
}
