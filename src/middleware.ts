import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // 📊 LOG DE COOKIES (Debug)
    const allCookies = request.cookies.getAll().map(c => c.name);
    console.log(`>>> [PROXY] Request to ${request.nextUrl.pathname}. Cookies found: ${allCookies.join(', ') || 'NONE'}`);

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    const cookie = request.cookies.get(name)
                    console.log(`>>> [COOKIE] Getting ${name}: ${cookie ? 'found' : 'not found'}`)
                    return cookie?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    console.log(`>>> [COOKIE] Setting ${name}`)
                    request.cookies.set({
                        name,
                        value,
                    })
                    response = NextResponse.next({
                        request,
                    })
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                        secure: process.env.NODE_ENV === 'production',
                        httpOnly: true,
                        sameSite: 'lax',
                        path: '/',
                        maxAge: 60 * 60 * 24 * 7, // 7 días
                    })
                },
                remove(name: string, options: CookieOptions) {
                    console.log(`>>> [COOKIE] Removing ${name}`)
                    request.cookies.set({
                        name,
                        value: '',
                    })
                    response = NextResponse.next({
                        request,
                    })
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                        secure: process.env.NODE_ENV === 'production',
                        httpOnly: true,
                        sameSite: 'lax',
                        path: '/',
                        maxAge: 0,
                    })
                },
            },
        }
    )

    // 🆕 Añadir timeout y manejo de errores para evitar que la página se quede en blanco
    let session = null;
    try {
        console.log(`>>> [PROXY] Checking session for ${request.nextUrl.pathname}...`);
        const { data } = await Promise.race([
            supabase.auth.getSession(),
            new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout en getSession')), 5000))
        ]);
        session = data.session;
    } catch (error: any) {
        // Manejar específicamente el error de refresh token
        if (error?.code === 'refresh_token_not_found' || error?.message?.includes('refresh_token')) {
            console.log('>>> [PROXY] Refresh token not found, clearing session');
            // Limpiar cookies rotas
            response.cookies.delete('sb-refresh-token');
            response.cookies.delete('sb-access-token');
        } else {
            console.error('>>> [PROXY] Error obteniendo sesión:', error);
        }
        // Continuamos sin sesión como fallback
        session = null;
    }

    if (session?.expires_at) {
        const expiresAt = session.expires_at * 1000
        const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000)
        if (expiresAt < fiveMinutesFromNow) {
            try {
                await supabase.auth.refreshSession()
            } catch (e) {
                console.error('>>> [PROXY] Error refrescando sesión:', e);
            }
        }
    }

    const protectedPaths = ['/', '/tesoreria', '/hermanos', '/avisos', '/config'];
    const isProtectedPath = protectedPaths.some(path =>
        request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
    )

    console.log(`>>> [PROXY] Session check: ${session ? 'Authenticated' : 'No session'} for ${request.nextUrl.pathname}`);

    if (!session && isProtectedPath && request.nextUrl.pathname !== '/login') {
        console.log(`>>> [PROXY] Redirecting to login - No session on protected path`);
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (session && request.nextUrl.pathname === '/login') {
        console.log(`>>> [PROXY] Redirecting to home - Has session on login page`);
        return NextResponse.redirect(new URL('/', request.url))
    }

    const isDev = process.env.NODE_ENV === 'development';
    const securityHeaders = {
        'Content-Security-Policy': isDev ? "" : "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.google-analytics.com; img-src 'self' data: https: blob:;",
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    }

    Object.entries(securityHeaders).forEach(([key, value]) => {
        if (value) response.headers.set(key, value)
    })

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
