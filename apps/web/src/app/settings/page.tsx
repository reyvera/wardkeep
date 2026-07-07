'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Save, Shield, Key, Clock, AlertTriangle, Settings, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface UserSettings {
  aiPrivacyMode: string;
  openaiKey?: string | null;
  anthropicKey?: string | null;
  backupSchedule: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [form, setForm] = useState<UserSettings>({ aiPrivacyMode: 'LOCAL', openaiKey: '', anthropicKey: '', backupSchedule: 'DAILY' });

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => apiClient.get<UserSettings>('/settings') });

  useEffect(() => { if (settingsQuery.data) setForm(settingsQuery.data); }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.patch('/settings', form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate(); };

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-content-primary">Settings</h1>

      {settingsQuery.isLoading && (
        <div className="space-y-6 max-w-xl">
          <div className="card space-y-4">
            <div className="skeleton h-4 w-32" /><div className="skeleton h-10 w-full" />
            <div className="skeleton h-4 w-32" /><div className="skeleton h-10 w-full" />
          </div>
        </div>
      )}

      {settingsQuery.isError && <div className="card"><p className="text-accent-red text-sm">{settingsQuery.error.message}</p></div>}

      {settingsQuery.data && (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
          {saveMutation.isSuccess && (
            <div className="rounded-lg bg-accent-green/10 border border-accent-green/20 px-4 py-3">
              <p className="text-sm text-accent-green">Settings saved successfully.</p>
            </div>
          )}
          {saveMutation.isError && (
            <div className="rounded-lg bg-accent-red/10 border border-accent-red/20 px-4 py-3">
              <p className="text-sm text-accent-red">{saveMutation.error.message}</p>
            </div>
          )}

          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-purple/10"><Shield size={16} className="text-accent-purple" /></div>
              <span className="card-title mb-0">AI PRIVACY MODE</span>
            </div>
            <div>
              <label className="input-label">Privacy Level</label>
              <select value={form.aiPrivacyMode} onChange={(e) => setForm({ ...form, aiPrivacyMode: e.target.value })} className="input">
                <option value="LOCAL">Local (Ollama only)</option>
                <option value="HYBRID">Hybrid (sensitive data stays local)</option>
                <option value="CLOUD">Cloud (all data sent to cloud provider)</option>
              </select>
              {form.aiPrivacyMode === 'CLOUD' && (
                <div className="mt-3 rounded-lg bg-accent-yellow/10 border border-accent-yellow/20 px-4 py-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-accent-yellow flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-accent-yellow">Cloud mode sends all financial data to the configured cloud AI provider.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-blue/10"><Key size={16} className="text-accent-blue" /></div>
              <span className="card-title mb-0">API KEYS</span>
            </div>
            <div>
              <label className="input-label">OpenAI API Key</label>
              <input type="password" value={form.openaiKey ?? ''} onChange={(e) => setForm({ ...form, openaiKey: e.target.value })} placeholder="sk-..." className="input" />
            </div>
            <div>
              <label className="input-label">Anthropic API Key</label>
              <input type="password" value={form.anthropicKey ?? ''} onChange={(e) => setForm({ ...form, anthropicKey: e.target.value })} placeholder="sk-ant-..." className="input" />
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-green/10"><Clock size={16} className="text-accent-green" /></div>
              <span className="card-title mb-0">BACKUP SCHEDULE</span>
            </div>
            <div>
              <label className="input-label">Frequency</label>
              <select value={form.backupSchedule} onChange={(e) => setForm({ ...form, backupSchedule: e.target.value })} className="input">
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
            <Save size={16} /> {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      )}

      {!settingsQuery.data && !settingsQuery.isLoading && !settingsQuery.isError && (
        <div className="card text-center py-12">
          <Settings size={40} className="mx-auto text-content-tertiary mb-3" />
          <p className="text-content-secondary text-sm">Unable to load settings</p>
        </div>
      )}

      {/* Sign Out — visible for mobile users who access settings via "More" tab */}
      <div className="max-w-xl pt-4 border-t border-edge">
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-content-tertiary hover:text-accent-red transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
