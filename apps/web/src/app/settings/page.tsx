'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface Settings {
  aiPrivacyMode: string;
  openaiKey?: string | null;
  anthropicKey?: string | null;
  backupSchedule: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Settings>({
    aiPrivacyMode: 'LOCAL',
    openaiKey: '',
    anthropicKey: '',
    backupSchedule: 'DAILY',
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.get<Settings>('/settings'),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.patch('/settings', form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {settingsQuery.isLoading && <p className="text-gray-500">Loading...</p>}
      {settingsQuery.isError && <p className="text-red-600">{settingsQuery.error.message}</p>}

      {settingsQuery.data && (
        <form onSubmit={handleSubmit} className="rounded-lg bg-white p-6 shadow-sm space-y-6 max-w-xl">
          {saveMutation.isSuccess && (
            <p className="text-sm text-green-600">Settings saved successfully.</p>
          )}
          {saveMutation.isError && (
            <p className="text-sm text-red-600">{saveMutation.error.message}</p>
          )}

          {/* AI Privacy Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Privacy Mode
            </label>
            <select
              value={form.aiPrivacyMode}
              onChange={(e) => setForm({ ...form, aiPrivacyMode: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="LOCAL">Local (Ollama only)</option>
              <option value="HYBRID">Hybrid (sensitive data stays local)</option>
              <option value="CLOUD">Cloud (all data sent to cloud provider)</option>
            </select>
            {form.aiPrivacyMode === 'CLOUD' && (
              <p className="mt-1 text-sm text-yellow-600">
                ⚠️ Cloud mode sends all financial data to the configured cloud AI provider.
                Ensure you trust the provider with your data.
              </p>
            )}
          </div>

          {/* API Keys */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={form.openaiKey ?? ''}
              onChange={(e) => setForm({ ...form, openaiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anthropic API Key
            </label>
            <input
              type="password"
              value={form.anthropicKey ?? ''}
              onChange={(e) => setForm({ ...form, anthropicKey: e.target.value })}
              placeholder="sk-ant-..."
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          {/* Backup Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Backup Schedule
            </label>
            <select
              value={form.backupSchedule}
              onChange={(e) => setForm({ ...form, backupSchedule: e.target.value })}
              className="w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-md bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      )}
    </div>
  );
}
