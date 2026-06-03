import { createServerClient, type CookieMethodsServer } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Hostname → allowed path prefixes + post-auth redirect
const DOMAIN_CONFIG: Record<string, { allowed: string[]; home: string }> = {
  'reports.chaika.team': {
    allowed: ['/reports', '/waiters', '/login', '/auth', '/change-password'],
    home: '/reports',
  },
  'office.chaika.team': {
    allowed: ['/expenses', '/expense-report', '/accounting-expenses', '/login', '/auth', '/change-password'],
    home: '/expenses',
  },
  'dashboard.chaika.team': {
    allowed: ['/dashboard', '/iiko', '/employees', '/establishments', '/approvers', '/waiter-log', '/login', '/auth', '/change-password'],
    home: '/dashboard',
  },
}

function getDomainConfig(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-host')
  const raw = forwarded ?? request.nextUrl.hostname
  const host = raw.split(':')[0] ?? raw
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
        setAll: (cookiesToSet: Parameters<NonNullable<CookieMethodsServer['setAll']>>[0]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isAuth = pathname.startsWith('/login') || pathname.startsWith('/auth')
  const isChangePassword = pathname.startsWith('/change-password')

  if (!user && !isAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  const domainCfg = getDomainConfig(request)

  if (user && isAuth) {
    const url = request.nextUrl.clone()
    url.pathname = domainCfg?.home ?? '/reports'
    return NextResponse.redirect(url)
  }

  // Check must_change_password flag — redirect to change-password page
  if (user && !isChangePassword) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('id', user.id)
      .single()

    if (profile?.must_change_password) {
      const url = request.nextUrl.clone()
      url.pathname = '/change-password'
      return NextResponse.redirect(url)
    }
  }

  // Enforce domain isolation
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
