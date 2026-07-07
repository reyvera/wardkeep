'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

/**
 * Client-side auth guard that registers the global 401 handler.
 * When any API call returns 401 (session expired/inactive), this
 * clears local auth state and redirects to login.
 *
 * Mount once inside the AppShell — wraps all authenticated routes.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const storeLogout = useAuthStore((s) => s.logout);
  const isRedirecting = useRef(false);

  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      // Prevent multiple simultaneous redirects from concurrent 401s
      if (isRedirecting.current) return;
      isRedirecting.current = true;
      storeLogout();
      router.push('/login');
    });

    // No cleanup — handler should persist for the app's lifetime.
    // The AppShell only unmounts when navigating to auth pages,
    // at which point the handler is irrelevant.
  }, [storeLogout, router]);

  return <>{children}</>;
}
