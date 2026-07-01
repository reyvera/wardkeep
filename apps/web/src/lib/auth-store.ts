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
      apiClient.setToken(token);
    } else {
      localStorage.removeItem('token');
      apiClient.setToken(null);
    }
    set({ token, isAuthenticated: !!token });
  },
  logout: () => {
    localStorage.removeItem('token');
    apiClient.setToken(null);
    set({ token: null, isAuthenticated: false });
  },
}));
