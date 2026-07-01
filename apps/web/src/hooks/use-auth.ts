'use client';

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

  const logout = () => {
    storeLogout();
    router.push('/login');
  };

  return { isAuthenticated, login, register, logout };
}
