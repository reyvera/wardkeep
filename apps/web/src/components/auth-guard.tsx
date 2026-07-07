'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

/**
 * Client-side auth guard that registers the global 401 handler
 * and redirects unauthenticated users to login.
 * Mount this inside the app shell to protect all authenticated routes.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { logout: storeLogout } = useAuthStore();

  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      storeLogout();
      router.push('/login');
    });

    return () => {
      apiClient.setUnauthorizedHandler(null);
    };
  }, [storeLogout, router]);

  return <>{children}</>;
}
