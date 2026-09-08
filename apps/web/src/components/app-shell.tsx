'use client';

import { usePathname } from 'next/navigation';

import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';
import { DemoBanner } from './demo-banner';
import { AuthGuard } from './auth-guard';

/** Pages that should NOT show the navigation shell */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];
const PUBLIC_ROUTES = ['/'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = AUTH_ROUTES.some((route) => pathname?.startsWith(route));
  const isPublicPage = PUBLIC_ROUTES.includes(pathname ?? '');

  if (isAuthPage || isPublicPage) {
    return <>{children}</>;
  }

  return (
    <AuthGuard>
      <div className="flex h-[100dvh] flex-col md:h-auto md:min-h-screen md:flex-row">
        {/* Demo banner */}
        <DemoBanner />

        {/* Desktop sidebar */}
        <Sidebar />

        {/* Main content */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-content px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 md:px-8 md:py-8">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <MobileNav />
      </div>
    </AuthGuard>
  );
}
