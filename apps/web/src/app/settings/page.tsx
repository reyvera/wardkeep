'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Save, Shield, Key, Clock, AlertTriangle, Settings, LogOut, Power, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ACCENT_PRESETS, useTheme } from '@/components/theme-provider';

interface UserSettings {
  aiPrivacyMode: string;
  openaiKey?: string | null;
  anthropicKey?: string | null;
  backupSchedule: string;
}

interface CapabilitySetting {
  id: string;
  name: string;
  description: string;
  pillars: string[];
  isEnabled: boolean;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { theme, resolvedTheme, setTheme, accentTheme, customAccent, setAccentTheme, setCustomAccent } = useTheme();
  const themeImportRef = useRef<HTMLInputElement>(null);
  const [themeImportError, setThemeImportError] = useState<string | null>(null);
  const accentContrast = (foreground: string, background: string) => {
    const rgb = (value: string) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
    const luminance = (value: string) => rgb(value).map((component) => component <= 0.03928 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4).reduce((total, component, index) => total + component * [0.2126, 0.7152, 0.0722][index], 0);
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  };
  const activeAccent = accentTheme === 'custom' ? customAccent : ACCENT_PRESETS[accentTheme].color;
  const accentTextContrast = accentContrast(activeAccent, resolvedTheme === 'dark' ? '#0d0f12' : '#ffffff');
  const exportTheme = () => {
    const contents = JSON.stringify({ version: 1, theme, accentTheme, customAccent }, null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'wardkeep-theme.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const importTheme = async (file: File) => {
    setThemeImportError(null);
    try {
      const value: unknown = JSON.parse(await file.text());
      if (!value || typeof value !== 'object') throw new Error('Theme file must contain a JSON object.');
      const record = value as Record<string, unknown>;
      if (!['dark', 'light', 'system'].includes(String(record.theme))) throw new Error('Theme file has an unsupported appearance setting.');
      if (record.accentTheme === 'custom') {
        if (typeof record.customAccent !== 'string' || !/^#[0-9a-f]{6}$/i.test(record.customAccent)) throw new Error('Theme file has an invalid custom accent.');
        setCustomAccent(record.customAccent);
      } else if (typeof record.accentTheme === 'string' && record.accentTheme in ACCENT_PRESETS) {
        setAccentTheme(record.accentTheme as keyof typeof ACCENT_PRESETS);
      } else {
        throw new Error('Theme file has an unsupported accent setting.');
      }
      setTheme(record.theme as 'dark' | 'light' | 'system');
    } catch (error) {
      setThemeImportError(error instanceof Error ? error.message : 'Theme file could not be imported.');
    }
  };
  const [form, setForm] = useState<UserSettings>({ aiPrivacyMode: 'LOCAL', openaiKey: '', anthropicKey: '', backupSchedule: 'DAILY' });

  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: () => apiClient.get<UserSettings>('/settings') });
  const capabilitiesQuery = useQuery({ queryKey: ['capabilities'], queryFn: () => apiClient.get<CapabilitySetting[]>('/capabilities') });

  useEffect(() => { if (settingsQuery.data) setForm(settingsQuery.data); }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => apiClient.patch('/settings', form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });
  const capabilityMutation = useMutation({
    mutationFn: ({ id, enable }: { id: string; enable: boolean }) =>
      apiClient.post(`/capabilities/${id}/${enable ? 'enable' : 'disable'}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capabilities'] });
      queryClient.invalidateQueries({ queryKey: ['readiness'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate(); };

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-content-primary">Settings</h1>

      <section className="card max-w-xl space-y-3" aria-labelledby="appearance-heading">
        <div>
          <h2 id="appearance-heading" className="card-title mb-0">APPEARANCE</h2>
          <p className="mt-1 text-xs text-content-secondary">Choose how Wardkeep appears on this device. Your choice is stored locally.</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'dark' as const, label: 'Dark', icon: Moon },
            { value: 'light' as const, label: 'Light', icon: Sun },
            { value: 'system' as const, label: 'System', icon: Monitor },
          ].map((option) => {
            const Icon = option.icon;
            const selected = theme === option.value;
            return (
              <button key={option.value} type="button" onClick={() => setTheme(option.value)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${selected ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-edge text-content-secondary hover:border-edge-hover'}`}
                aria-pressed={selected}>
                <Icon size={15} /> {option.label}
              </button>
            );
          })}
        </div>
        {theme === 'system' && <p className="text-xs text-content-tertiary">Following your device: {resolvedTheme} appearance.</p>}
        <div className="border-t border-edge pt-3">
          <p className="input-label">Accent</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
              <button key={key} type="button" onClick={() => setAccentTheme(key as keyof typeof ACCENT_PRESETS)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${accentTheme === key ? 'border-accent-blue text-content-primary' : 'border-edge text-content-secondary'}`}
                aria-pressed={accentTheme === key}>
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.color }} />{preset.label}
              </button>
            ))}
            <label className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${accentTheme === 'custom' ? 'border-accent-blue text-content-primary' : 'border-edge text-content-secondary'}`}>
              <input type="color" value={customAccent} onChange={(event) => setCustomAccent(event.target.value)} className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" aria-label="Custom accent color" />Custom
            </label>
          </div>
          <p className={`mt-2 text-xs ${accentTextContrast >= 4.5 ? 'text-content-tertiary' : 'text-accent-yellow'}`}>
            Accent-to-background contrast: {accentTextContrast.toFixed(1)}:1 {accentTextContrast >= 4.5 ? '· meets normal-text contrast guidance.' : '· may be hard to read as text; choose a higher-contrast color if needed.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={exportTheme} className="btn-secondary text-xs">Export theme</button>
            <button type="button" onClick={() => themeImportRef.current?.click()} className="btn-secondary text-xs">Import theme</button>
            <input ref={themeImportRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importTheme(file);
              event.currentTarget.value = '';
            }} />
          </div>
          {themeImportError && <p className="mt-2 text-xs text-accent-red">{themeImportError}</p>}
        </div>
      </section>

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

      <section className="card max-w-xl space-y-4" aria-labelledby="capabilities-heading">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-blue/10"><Power size={16} className="text-accent-blue" /></div>
          <div>
            <h2 id="capabilities-heading" className="card-title mb-0">HOUSEHOLD CAPABILITIES</h2>
            <p className="mt-1 text-xs text-content-secondary">Choose which parts of your household information Wardkeep uses in your household picture.</p>
          </div>
        </div>
        {capabilitiesQuery.isLoading && <div className="space-y-2"><div className="skeleton h-16 w-full" /><div className="skeleton h-16 w-full" /></div>}
        {capabilitiesQuery.isError && <p className="text-sm text-accent-red">{capabilitiesQuery.error.message}</p>}
        {capabilitiesQuery.data?.map((capability) => (
          <div key={capability.id} className="flex items-center justify-between gap-4 rounded-lg border border-edge bg-surface-secondary p-3">
            <div>
              <p className="text-sm font-medium text-content-primary">{capability.name}</p>
              <p className="mt-1 text-xs text-content-secondary">{capability.description}</p>
              <p className="mt-1 text-xs text-content-tertiary">{capability.pillars.join(' · ')}</p>
            </div>
            <button
              type="button"
              className={capability.isEnabled ? 'btn-secondary shrink-0' : 'btn-primary shrink-0'}
              disabled={capabilityMutation.isPending}
              onClick={() => capabilityMutation.mutate({ id: capability.id, enable: !capability.isEnabled })}
              aria-pressed={capability.isEnabled}
            >
              {capability.isEnabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
      </section>

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
