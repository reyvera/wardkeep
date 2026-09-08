import { create } from 'zustand';
import { apiClient } from './api-client';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  hydrate: () => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Keep the server and browser's initial render identical. AuthGuard restores
  // the persisted bearer token after the client has mounted.
  token: null,
  isAuthenticated: false,
  hydrated: false,
  hydrate: () => {
    const token = localStorage.getItem('token');
    apiClient.setToken(token);
    set({ token, isAuthenticated: !!token, hydrated: true });
  },
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
      apiClient.setToken(token);
    } else {
      localStorage.removeItem('token');
      apiClient.setToken(null);
    }
    set({ token, isAuthenticated: !!token, hydrated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    apiClient.setToken(null);
    set({ token: null, isAuthenticated: false, hydrated: true });
  },
}));
