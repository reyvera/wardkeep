import { create } from 'zustand';
import { apiClient } from './api-client';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('token') : false,
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
      document.cookie = `token=${token}; path=/; SameSite=Strict`;
      apiClient.setToken(token);
    } else {
      localStorage.removeItem('token');
      document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      apiClient.setToken(null);
    }
    set({ token, isAuthenticated: !!token });
  },
  logout: () => {
    localStorage.removeItem('token');
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    apiClient.setToken(null);
    set({ token: null, isAuthenticated: false });
  },
}));
