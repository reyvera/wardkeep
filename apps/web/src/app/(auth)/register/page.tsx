'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';

export default function RegisterPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const registerMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ token: string }>('/auth/register', { email, password, confirmPassword }),
    onSuccess: (data) => {
      setToken(data.token);
      router.push('/dashboard');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-accent-blue flex items-center justify-center">
            <span className="text-white text-xl font-bold">B</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-content-primary mb-2">Create Account</h1>
        <p className="text-sm text-center text-content-tertiary mb-8">Start managing your finances</p>

        {registerMutation.isError && (
          <div className="mb-4 rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3">
            <p className="text-sm text-accent-red">{registerMutation.error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="input-label">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" required />
          </div>
          <div>
            <label htmlFor="password" className="input-label">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••••••" required />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="input-label">Confirm Password</label>
            <input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input" placeholder="••••••••••••" required />
          </div>
          <button type="submit" disabled={registerMutation.isPending} className="btn-primary w-full">
            {registerMutation.isPending ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-content-tertiary">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-blue hover:underline">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
