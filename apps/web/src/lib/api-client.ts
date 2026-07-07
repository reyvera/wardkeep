import { offlineQueue } from './offline-queue';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

class ApiClient {
  private token: string | null = null;
  private onUnauthorized: (() => void) | null = null;

  constructor() {
    // Restore token from localStorage on initialization (client-side only)
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  /**
   * Register a callback that fires when a 401 response is received.
   * Used to trigger automatic logout and redirect on session expiry.
   * @param callback - Function to call on unauthorized response
   */
  setUnauthorizedHandler(callback: (() => void) | null) {
    this.onUnauthorized = callback;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  getApiBase(): string {
    return API_BASE;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, ...options?.headers },
      });

      if (!res.ok) {
        // Handle 401 — session expired or invalid
        if (res.status === 401 && !path.startsWith('/auth/')) {
          this.onUnauthorized?.();
        }

        const error = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message ?? `HTTP ${res.status}`);
      }

      if (res.status === 204) return undefined as T;
      return res.json();
    } catch (error) {
      const method = options?.method ?? 'GET';

      // Queue mutating requests when offline
      if (
        typeof navigator !== 'undefined' &&
        !navigator.onLine &&
        ['POST', 'PATCH', 'DELETE'].includes(method)
      ) {
        const body = options?.body ? JSON.parse(options.body as string) : undefined;
        const queued = offlineQueue.add({ method, path, body });
        if (queued) {
          return { _queued: true } as T;
        }
      }

      throw error;
    }
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
