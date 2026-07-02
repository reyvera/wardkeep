'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');

  const forgotMutation = useMutation({
    mutationFn: () => apiClient.post('/auth/forgot-password', { email }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    forgotMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-accent-blue flex items-center justify-center">
            <span className="text-white text-xl font-bold">B</span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center text-content-primary mb-2">Reset Password</h1>
        <p className="text-sm text-center text-content-tertiary mb-8">Enter your email and we&apos;ll send a reset link</p>

        {forgotMutation.isSuccess && (
          <div className="mb-4 rounded-lg bg-accent-green/10 border border-accent-green/20 px-4 py-3">
            <p className="text-sm text-accent-green">If an account with that email exists, a reset link has been sent.</p>
          </div>
        )}

        {forgotMutation.isError && (
          <div className="mb-4 rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3">
            <p className="text-sm text-accent-red">{forgotMutation.error.message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="input-label">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" required />
          </div>
          <button type="submit" disabled={forgotMutation.isPending} className="btn-primary w-full">
            {forgotMutation.isPending ? 'Sending...' : <><Mail size={16} /> Send Reset Link</>}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-content-tertiary">
          <Link href="/login" className="text-accent-blue hover:underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
