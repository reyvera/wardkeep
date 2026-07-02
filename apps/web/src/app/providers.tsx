'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ThemeProvider } from '@/components/theme-provider';
import { ToastProvider } from '@/components/toast';
import { registerServiceWorker } from '@/lib/register-sw';
import { offlineQueue } from '@/lib/offline-queue';
import { apiClient } from '@/lib/api-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30000 } },
      }),
  );

  useEffect(() => {
    registerServiceWorker();
    offlineQueue.load();

    // Flush offline queue when coming back online
    const handleOnline = async () => {
      const token = apiClient.getToken();
      const apiBase = apiClient.getApiBase();
      await offlineQueue.flush(apiBase, token);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
