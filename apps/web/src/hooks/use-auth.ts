'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  token: string;
}

export function useAuth() {
  const router = useRouter();
  const { isAuthenticated, setToken, logout: storeLogout } = useAuthStore();

  const logout = useCallback(() => {
    // Fire-and-forget API call to invalidate server session
    apiClient.post('/auth/logout').catch(() => {
      // Ignore errors — we're clearing local state regardless
    });
    storeLogout();
    router.push('/login');
  }, [storeLogout, router]);

  // Register the unauthorized handler so any 401 response auto-redirects
  useEffect(() => {
    apiClient.setUnauthorizedHandler(() => {
      storeLogout();
      router.push('/login');
    });

    return () => {
      apiClient.setUnauthorizedHandler(null);
    };
  }, [storeLogout, router]);

  const login = async (credentials: LoginCredentials) => {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    setToken(response.token);
    router.push('/dashboard');
  };

  const register = async (credentials: RegisterCredentials) => {
    const response = await apiClient.post<AuthResponse>('/auth/register', credentials);
    setToken(response.token);
    router.push('/dashboard');
  };

  return { isAuthenticated, login, register, logout };
}
