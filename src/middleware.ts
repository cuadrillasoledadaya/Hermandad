import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    })
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    })
                },
            },
        }
    )

    // OBTENER Y REFRESCAR SESIÓN SI ES NECESARIO
    const { data: { session } } = await supabase.auth.getSession()

    // Si hay sesión y el token está próximo a expirar, refrescarlo
    if (session?.expires_at) {
        const expiresAt = session.expires_at * 1000 // Convertir a milisegundos
        const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000)

        if (expiresAt < fiveMinutesFromNow) {
            await supabase.auth.refreshSession()
        }
    }

    console.log('Middleware Path:', request.nextUrl.pathname, 'Session exists:', !!session);

    // Protected routes logic
    const isProtectedPath = ['/', '/tesoreria', '/hermanos', '/avisos', '/config'].some(path =>
        request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
    )

    if (!session && isProtectedPath && request.nextUrl.pathname !== '/login') {
        console.log('Middleware: Redirecting to /login (no session)');
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (session && request.nextUrl.pathname === '/login') {
        console.log('Middleware: Redirecting to / (already logged in)');
        return NextResponse.redirect(new URL('/', request.url))
    }

    // AÑADIR HEADERS DE SEGURIDAD - ESTO PROTEGE CONTRA ATAQUES
    const securityHeaders = {
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.google-analytics.com; img-src 'self' data: https: blob:;",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    }

    Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value)
    })

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
