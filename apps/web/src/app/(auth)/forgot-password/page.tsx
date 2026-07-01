'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-2xl font-bold text-center">Reset Password</h1>
        {forgotMutation.isSuccess && (
          <p className="mb-4 text-sm text-green-600">
            If an account with that email exists, a reset link has been sent.
          </p>
        )}
        {forgotMutation.isError && (
          <p className="mb-4 text-sm text-red-600">{forgotMutation.error.message}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={forgotMutation.isPending}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {forgotMutation.isPending ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-600">
          <Link href="/login" className="text-blue-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
