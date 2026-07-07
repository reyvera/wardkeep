import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Public paths that don't require authentication.
 */
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

/**
 * Middleware that redirects unauthenticated users to the login page.
 * Auth token is stored in localStorage (client-side), so we check for
 * a cookie-based token marker set by the client on login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and API routes through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  // Allow public auth paths through
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for auth token cookie
  const token = request.cookies.get('token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users from root to dashboard
  if (pathname === '/') {
    const dashboardUrl = new URL('/dashboard', request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)'],
};
