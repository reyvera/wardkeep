'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => apiClient.post<{ token: string }>('/auth/login', { email, password }),
    onSuccess: (data) => {
      setToken(data.token);
      router.push('/dashboard');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-accent-blue flex items-center justify-center">
            <span className="text-white text-xl font-bold">W</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-content-primary mb-2">Welcome back</h1>
        <p className="text-sm text-center text-content-tertiary mb-8">Sign in to your account</p>

        {loginMutation.isError && (
          <div className="mb-4 rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3">
            <p className="text-sm text-accent-red">{loginMutation.error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="input-label">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="input-label">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="btn-primary w-full"
          >
            {loginMutation.isPending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-content-tertiary">
          <Link href="/forgot-password" className="text-accent-blue hover:underline">
            Forgot password?
          </Link>
          <span className="mx-2">·</span>
          <Link href="/register" className="text-accent-blue hover:underline">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
