'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Save,
  Shield,
  Key,
  Clock,
  AlertTriangle,
  Settings,
  LogOut,
  Power,
  Monitor,
  Moon,
  Sun,
  DatabaseBackup,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { ACCENT_PRESETS, useTheme } from '@/components/theme-provider';

interface UserSettings {
  aiPrivacyMode: string;
  openaiKey?: string | null;
  anthropicKey?: string | null;
  backupSchedule: string | null;
  scheduledBackupLastRunAt?: string | null;
}

interface CapabilitySetting {
  id: string;
  name: string;
  description: string;
  pillars: string[];
  isEnabled: boolean;
}

interface BackupRecord {
  id: string;
  filename: string;
  size: number;
  isAutomated: boolean;
  createdAt: string;
}

interface RemoteBackupPeer {
  id: string;
  peerName: string;
  peerUrl: string;
  direction: 'PUSH' | 'PULL' | 'BOTH';
  status: 'PENDING' | 'PAIRED' | 'UNREACHABLE' | 'REVOKED';
  syncSchedule?: 'HOURLY' | 'EVERY_6H' | 'DAILY' | 'WEEKLY' | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
}

interface RemoteBackupOffer {
  offerId: string;
  secret: string;
  direction: 'PUSH' | 'PULL' | 'BOTH';
  expiresAt: string;
}

interface RemoteBackupRecord {
  id: string;
  recoveryClass: 'SOURCE_TIED_AUTOMATED' | 'PORTABLE_MANUAL';
  size: number;
  checksum: string;
  createdAt: string;
  receivedAt: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const {
    theme,
    resolvedTheme,
    setTheme,
    accentTheme,
    customAccent,
    setAccentTheme,
    setCustomAccent,
  } = useTheme();
  const themeImportRef = useRef<HTMLInputElement>(null);
  const [themeImportError, setThemeImportError] = useState<string | null>(null);
  const accentContrast = (foreground: string, background: string) => {
    const rgb = (value: string) =>
      [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
    const luminance = (value: string) =>
      rgb(value)
        .map((component) =>
          component <= 0.03928 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (total, component, index) => total + component * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
  };
  const activeAccent = accentTheme === 'custom' ? customAccent : ACCENT_PRESETS[accentTheme].color;
  const accentTextContrast = accentContrast(
    activeAccent,
    resolvedTheme === 'dark' ? '#0d0f12' : '#ffffff',
  );
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
      if (!value || typeof value !== 'object')
        throw new Error('Theme file must contain a JSON object.');
      const record = value as Record<string, unknown>;
      if (!['dark', 'light', 'system'].includes(String(record.theme)))
        throw new Error('Theme file has an unsupported appearance setting.');
      if (record.accentTheme === 'custom') {
        if (typeof record.customAccent !== 'string' || !/^#[0-9a-f]{6}$/i.test(record.customAccent))
          throw new Error('Theme file has an invalid custom accent.');
        setCustomAccent(record.customAccent);
      } else if (typeof record.accentTheme === 'string' && record.accentTheme in ACCENT_PRESETS) {
        setAccentTheme(record.accentTheme as keyof typeof ACCENT_PRESETS);
      } else {
        throw new Error('Theme file has an unsupported accent setting.');
      }
      setTheme(record.theme as 'dark' | 'light' | 'system');
    } catch (error) {
      setThemeImportError(
        error instanceof Error ? error.message : 'Theme file could not be imported.',
      );
    }
  };
  const [form, setForm] = useState<UserSettings>({
    aiPrivacyMode: 'LOCAL',
    openaiKey: '',
    anthropicKey: '',
    backupSchedule: null,
  });
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupPassphraseConfirmation, setBackupPassphraseConfirmation] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [remoteBackupPeerId, setRemoteBackupPeerId] = useState<string | null>(null);
  const [remoteRestoreTarget, setRemoteRestoreTarget] = useState<RemoteBackupRecord | null>(null);
  const [remoteRestorePassphrase, setRemoteRestorePassphrase] = useState('');
  const [recoveryImport, setRecoveryImport] = useState({
    peerUrl: '',
    offerId: '',
    secret: '',
    passphrase: '',
  });
  const [pairingOffer, setPairingOffer] = useState<RemoteBackupOffer | null>(null);
  const [offerPeerName, setOfferPeerName] = useState('Wardkeep off-site destination');
  const [connectForm, setConnectForm] = useState({
    offerId: '',
    secret: '',
    peerUrl: '',
    peerName: '',
    localPeerName: 'Wardkeep',
    direction: 'BOTH' as const,
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiClient.get<UserSettings>('/settings'),
  });
  const capabilitiesQuery = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => apiClient.get<CapabilitySetting[]>('/capabilities'),
  });
  const backupsQuery = useQuery({
    queryKey: ['backups'],
    queryFn: () => apiClient.get<BackupRecord[]>('/backup/list'),
  });
  const remotePeersQuery = useQuery({
    queryKey: ['remote-backup-peers'],
    queryFn: () => apiClient.get<RemoteBackupPeer[]>('/remote-backup/peers'),
  });
  const remoteBackupsQuery = useQuery({
    queryKey: ['remote-backups', remoteBackupPeerId],
    queryFn: () =>
      apiClient.get<RemoteBackupRecord[]>(`/remote-backup/peers/${remoteBackupPeerId}/backups`),
    enabled: Boolean(remoteBackupPeerId),
  });

  useEffect(() => {
    if (settingsQuery.data) setForm(settingsQuery.data);
  }, [settingsQuery.data]);

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
  const createBackupMutation = useMutation({
    mutationFn: (passphrase: string) =>
      apiClient.post<BackupRecord>('/backup/create', { passphrase }),
    onSuccess: () => {
      setBackupPassphrase('');
      setBackupPassphraseConfirmation('');
      queryClient.invalidateQueries({ queryKey: ['backups'] });
    },
  });
  const restoreBackupMutation = useMutation({
    mutationFn: ({ backup, passphrase }: { backup: BackupRecord; passphrase?: string }) =>
      apiClient.post('/backup/restore', {
        backupId: backup.id,
        ...(passphrase ? { passphrase } : {}),
      }),
    onSuccess: () => {
      setRestoreTarget(null);
      setRestorePassphrase('');
      // A restore replaces the household's entire record set. Mark every cached
      // household view stale so later navigation cannot present pre-restore data.
      queryClient.invalidateQueries();
    },
  });
  const pushBackupMutation = useMutation({
    mutationFn: ({ peerId, backupId }: { peerId: string; backupId: string }) =>
      apiClient.post(`/remote-backup/peers/${peerId}/backups/${backupId}/push`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remote-backup-peers'] }),
  });
  const revokePeerMutation = useMutation({
    mutationFn: (peerId: string) => apiClient.post(`/remote-backup/peers/${peerId}/revoke`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remote-backup-peers'] }),
  });
  const setRemoteSyncScheduleMutation = useMutation({
    mutationFn: ({
      peerId,
      schedule,
    }: {
      peerId: string;
      schedule: RemoteBackupPeer['syncSchedule'];
    }) => apiClient.patch(`/remote-backup/peers/${peerId}/sync-schedule`, { schedule }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remote-backup-peers'] }),
  });
  const restoreRemoteBackupMutation = useMutation({
    mutationFn: ({
      peerId,
      backup,
      passphrase,
    }: {
      peerId: string;
      backup: RemoteBackupRecord;
      passphrase?: string;
    }) =>
      apiClient.post(`/remote-backup/peers/${peerId}/backups/${backup.id}/restore`, {
        ...(passphrase ? { passphrase } : {}),
      }),
    onSuccess: () => {
      setRemoteRestoreTarget(null);
      setRemoteRestorePassphrase('');
      queryClient.invalidateQueries();
    },
  });
  const recoveryImportMutation = useMutation({
    mutationFn: () => apiClient.post('/remote-backup/recovery/import', recoveryImport),
    onSuccess: () => {
      setRecoveryImport({ peerUrl: '', offerId: '', secret: '', passphrase: '' });
      queryClient.invalidateQueries();
    },
  });
  const createPairingOfferMutation = useMutation({
    mutationFn: () =>
      apiClient.post<RemoteBackupOffer>('/remote-backup/pair/offers', {
        peerName: offerPeerName,
        direction: 'BOTH',
      }),
    onSuccess: setPairingOffer,
  });
  const connectPeerMutation = useMutation({
    mutationFn: () => apiClient.post('/remote-backup/pair/connect', connectForm),
    onSuccess: () => {
      setConnectForm({
        offerId: '',
        secret: '',
        peerUrl: '',
        peerName: '',
        localPeerName: 'Wardkeep',
        direction: 'BOTH',
      });
      queryClient.invalidateQueries({ queryKey: ['remote-backup-peers'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };
  const handleCreateBackup = (event: React.FormEvent) => {
    event.preventDefault();
    if (backupPassphrase !== backupPassphraseConfirmation) return;
    createBackupMutation.mutate(backupPassphrase);
  };
  const handleRestoreBackup = (event: React.FormEvent) => {
    event.preventDefault();
    if (!restoreTarget) return;
    if (!restoreTarget.isAutomated && restorePassphrase.length < 12) return;
    if (
      !window.confirm(
        'Restore this backup? This permanently replaces the household data currently in Wardkeep.',
      )
    )
      return;
    restoreBackupMutation.mutate({
      backup: restoreTarget,
      ...(restoreTarget.isAutomated ? {} : { passphrase: restorePassphrase }),
    });
  };
  const handleRemoteRestoreBackup = (event: React.FormEvent) => {
    event.preventDefault();
    if (!remoteBackupPeerId || !remoteRestoreTarget) return;
    if (
      remoteRestoreTarget.recoveryClass === 'PORTABLE_MANUAL' &&
      remoteRestorePassphrase.length < 12
    )
      return;
    if (
      !window.confirm(
        'Restore this remote backup? This permanently replaces the household data currently in Wardkeep.',
      )
    )
      return;
    restoreRemoteBackupMutation.mutate({
      peerId: remoteBackupPeerId,
      backup: remoteRestoreTarget,
      ...(remoteRestoreTarget.recoveryClass === 'PORTABLE_MANUAL'
        ? { passphrase: remoteRestorePassphrase }
        : {}),
    });
  };
  const handleRecoveryImport = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      recoveryImport.passphrase.length < 12 ||
      !window.confirm(
        'Import and restore this portable recovery archive? This permanently replaces the household data currently in Wardkeep.',
      )
    )
      return;
    recoveryImportMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-content-primary">Settings</h1>

      <section className="card max-w-xl space-y-3" aria-labelledby="appearance-heading">
        <div>
          <h2 id="appearance-heading" className="card-title mb-0">
            APPEARANCE
          </h2>
          <p className="mt-1 text-xs text-content-secondary">
            Choose how Wardkeep appears on this device. Your choice is stored locally.
          </p>
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
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${selected ? 'border-accent-blue bg-accent-blue/10 text-accent-blue' : 'border-edge text-content-secondary hover:border-edge-hover'}`}
                aria-pressed={selected}
              >
                <Icon size={15} /> {option.label}
              </button>
            );
          })}
        </div>
        {theme === 'system' && (
          <p className="text-xs text-content-tertiary">
            Following your device: {resolvedTheme} appearance.
          </p>
        )}
        <div className="border-t border-edge pt-3">
          <p className="input-label">Accent</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAccentTheme(key as keyof typeof ACCENT_PRESETS)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${accentTheme === key ? 'border-accent-blue text-content-primary' : 'border-edge text-content-secondary'}`}
                aria-pressed={accentTheme === key}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: preset.color }} />
                {preset.label}
              </button>
            ))}
            <label
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${accentTheme === 'custom' ? 'border-accent-blue text-content-primary' : 'border-edge text-content-secondary'}`}
            >
              <input
                type="color"
                value={customAccent}
                onChange={(event) => setCustomAccent(event.target.value)}
                className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                aria-label="Custom accent color"
              />
              Custom
            </label>
          </div>
          <p
            className={`mt-2 text-xs ${accentTextContrast >= 4.5 ? 'text-content-tertiary' : 'text-accent-yellow'}`}
          >
            Accent-to-background contrast: {accentTextContrast.toFixed(1)}:1{' '}
            {accentTextContrast >= 4.5
              ? '· meets normal-text contrast guidance.'
              : '· may be hard to read as text; choose a higher-contrast color if needed.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={exportTheme} className="btn-secondary text-xs">
              Export theme
            </button>
            <button
              type="button"
              onClick={() => themeImportRef.current?.click()}
              className="btn-secondary text-xs"
            >
              Import theme
            </button>
            <input
              ref={themeImportRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importTheme(file);
                event.currentTarget.value = '';
              }}
            />
          </div>
          {themeImportError && <p className="mt-2 text-xs text-accent-red">{themeImportError}</p>}
        </div>
      </section>

      {settingsQuery.isLoading && (
        <div className="space-y-6 max-w-xl">
          <div className="card space-y-4">
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-10 w-full" />
          </div>
        </div>
      )}

      {settingsQuery.isError && (
        <div className="card">
          <p className="text-accent-red text-sm">{settingsQuery.error.message}</p>
        </div>
      )}

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
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-purple/10">
                <Shield size={16} className="text-accent-purple" />
              </div>
              <span className="card-title mb-0">AI PRIVACY MODE</span>
            </div>
            <div>
              <label className="input-label">Privacy Level</label>
              <select
                value={form.aiPrivacyMode}
                onChange={(e) => setForm({ ...form, aiPrivacyMode: e.target.value })}
                className="input"
              >
                <option value="LOCAL">Local (Ollama only)</option>
                <option value="HYBRID">Hybrid (sensitive data stays local)</option>
                <option value="CLOUD">Cloud (all data sent to cloud provider)</option>
              </select>
              {form.aiPrivacyMode === 'CLOUD' && (
                <div className="mt-3 rounded-lg bg-accent-yellow/10 border border-accent-yellow/20 px-4 py-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-accent-yellow flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-accent-yellow">
                    Cloud mode sends all financial data to the configured cloud AI provider.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-blue/10">
                <Key size={16} className="text-accent-blue" />
              </div>
              <span className="card-title mb-0">API KEYS</span>
            </div>
            <div>
              <label className="input-label">OpenAI API Key</label>
              <input
                type="password"
                value={form.openaiKey ?? ''}
                onChange={(e) => setForm({ ...form, openaiKey: e.target.value })}
                placeholder="sk-..."
                className="input"
              />
            </div>
            <div>
              <label className="input-label">Anthropic API Key</label>
              <input
                type="password"
                value={form.anthropicKey ?? ''}
                onChange={(e) => setForm({ ...form, anthropicKey: e.target.value })}
                placeholder="sk-ant-..."
                className="input"
              />
            </div>
          </div>

          <div className="card space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent-green/10">
                <Clock size={16} className="text-accent-green" />
              </div>
              <span className="card-title mb-0">BACKUP SCHEDULE</span>
            </div>
            <div>
              <label className="input-label">Frequency</label>
              <select
                value={form.backupSchedule ?? ''}
                onChange={(e) => setForm({ ...form, backupSchedule: e.target.value || null })}
                className="input"
              >
                <option value="">Off</option>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
              <p className="mt-2 text-xs text-content-secondary">
                Automatic backups are encrypted and kept on this Wardkeep deployment. You can turn
                them off at any time.
              </p>
              {form.scheduledBackupLastRunAt && (
                <p className="mt-1 text-xs text-content-tertiary">
                  Last automatic backup: {new Date(form.scheduledBackupLastRunAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
            <Save size={16} /> {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      )}

      <section className="card max-w-xl space-y-4" aria-labelledby="backup-recovery-heading">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-green/10">
            <DatabaseBackup size={16} className="text-accent-green" />
          </div>
          <div>
            <h2 id="backup-recovery-heading" className="card-title mb-0">
              BACKUP & RECOVERY
            </h2>
            <p className="mt-1 text-xs text-content-secondary">
              Create a manual encrypted copy, or restore a previous household state.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleCreateBackup}
          className="space-y-3 rounded-lg border border-edge bg-surface-secondary p-3"
        >
          <p className="text-sm font-medium text-content-primary">Create manual backup</p>
          <input
            type="password"
            value={backupPassphrase}
            onChange={(event) => setBackupPassphrase(event.target.value)}
            minLength={12}
            required
            placeholder="Backup passphrase (12+ characters)"
            className="input"
          />
          <input
            type="password"
            value={backupPassphraseConfirmation}
            onChange={(event) => setBackupPassphraseConfirmation(event.target.value)}
            minLength={12}
            required
            placeholder="Confirm backup passphrase"
            className="input"
          />
          {backupPassphraseConfirmation && backupPassphrase !== backupPassphraseConfirmation && (
            <p className="text-xs text-accent-red">Passphrases do not match.</p>
          )}
          {createBackupMutation.isError && (
            <p className="text-xs text-accent-red">{createBackupMutation.error.message}</p>
          )}
          {createBackupMutation.isSuccess && (
            <p className="text-xs text-accent-green">Manual backup created.</p>
          )}
          <button
            type="submit"
            className="btn-secondary"
            disabled={
              createBackupMutation.isPending ||
              backupPassphrase.length < 12 ||
              backupPassphrase !== backupPassphraseConfirmation
            }
          >
            <DatabaseBackup size={16} />{' '}
            {createBackupMutation.isPending ? 'Creating backup…' : 'Create backup'}
          </button>
        </form>

        <details className="rounded-lg border border-edge bg-surface-secondary p-3">
          <summary className="cursor-pointer text-sm font-medium text-content-primary">
            Restore from a recovery offer
          </summary>
          <p className="mt-2 text-xs text-content-secondary">
            Use this on a replacement Wardkeep deployment after an off-site receiver gives you a
            one-time recovery offer. Wardkeep verifies the encrypted archive before restoring it.
          </p>
          <form onSubmit={handleRecoveryImport} className="mt-3 space-y-2">
            <input
              type="url"
              required
              value={recoveryImport.peerUrl}
              onChange={(event) =>
                setRecoveryImport((current) => ({ ...current, peerUrl: event.target.value }))
              }
              placeholder="Receiver URL (https://receiver.example)"
              className="input"
            />
            <input
              required
              value={recoveryImport.offerId}
              onChange={(event) =>
                setRecoveryImport((current) => ({ ...current, offerId: event.target.value }))
              }
              placeholder="Recovery offer ID"
              className="input"
            />
            <input
              type="password"
              required
              value={recoveryImport.secret}
              onChange={(event) =>
                setRecoveryImport((current) => ({ ...current, secret: event.target.value }))
              }
              placeholder="Recovery offer secret"
              className="input"
            />
            <input
              type="password"
              required
              minLength={12}
              value={recoveryImport.passphrase}
              onChange={(event) =>
                setRecoveryImport((current) => ({ ...current, passphrase: event.target.value }))
              }
              placeholder="Manual backup passphrase"
              className="input"
            />
            {recoveryImportMutation.isError && (
              <p className="text-xs text-accent-red">
                The recovery offer could not be imported. Check the receiver URL, offer, and passphrase.
              </p>
            )}
            {recoveryImportMutation.isSuccess && (
              <p className="text-xs text-accent-green">Recovery archive restored.</p>
            )}
            <button
              type="submit"
              className="btn-secondary text-xs"
              disabled={recoveryImportMutation.isPending || recoveryImport.passphrase.length < 12}
            >
              <RotateCcw size={14} />
              {recoveryImportMutation.isPending ? 'Restoring…' : 'Verify and restore recovery archive'}
            </button>
          </form>
        </details>

        <div className="space-y-2">
          <p className="input-label">Available backups</p>
          {backupsQuery.isLoading && <div className="skeleton h-16 w-full" />}
          {backupsQuery.isError && (
            <p className="text-xs text-accent-red">{backupsQuery.error.message}</p>
          )}
          {backupsQuery.data?.length === 0 && (
            <p className="text-sm text-content-secondary">No backups yet.</p>
          )}
          {backupsQuery.data?.map((backup) => (
            <div
              key={backup.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface-secondary p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-content-primary">
                  {backup.isAutomated ? 'Automatic backup' : 'Manual backup'}
                </p>
                <p className="mt-1 truncate text-xs text-content-secondary">
                  {new Date(backup.createdAt).toLocaleString()} · {(backup.size / 1024).toFixed(1)}{' '}
                  KB
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary shrink-0 text-xs"
                onClick={() => setRestoreTarget(backup)}
              >
                <RotateCcw size={14} /> Restore
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-lg border border-edge bg-surface-secondary p-3">
          <p className="text-sm font-medium text-content-primary">Off-site destinations</p>
          <p className="text-xs text-content-secondary">
            A paired destination stores only encrypted archives. Automatic backups remain
            recoverable only on this deployment; manual backups require their recovery passphrase.
          </p>
          {remotePeersQuery.isLoading && <div className="skeleton h-10 w-full" />}
          {remotePeersQuery.isError && (
            <p className="text-xs text-accent-red">Could not load paired destinations.</p>
          )}
          {remotePeersQuery.data?.length === 0 && (
            <p className="text-xs text-content-secondary">No paired off-site destination yet.</p>
          )}

          <details className="border-t border-edge pt-3">
            <summary className="cursor-pointer text-xs font-medium text-content-primary">
              Pair another Wardkeep deployment
            </summary>
            <div className="mt-3 space-y-4">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  createPairingOfferMutation.mutate();
                }}
              >
                <p className="text-xs text-content-secondary">
                  Create a short-lived offer if this deployment will receive encrypted copies.
                </p>
                <label htmlFor="pairing-offer-name" className="input-label">
                  Destination name
                </label>
                <input
                  id="pairing-offer-name"
                  value={offerPeerName}
                  onChange={(event) => setOfferPeerName(event.target.value)}
                  required
                  maxLength={120}
                  placeholder="Destination name"
                  className="input"
                />
                <button
                  type="submit"
                  className="btn-secondary text-xs"
                  disabled={createPairingOfferMutation.isPending}
                >
                  {createPairingOfferMutation.isPending
                    ? 'Creating offer…'
                    : 'Create pairing offer'}
                </button>
                {createPairingOfferMutation.isError && (
                  <p className="text-xs text-accent-red">
                    The pairing offer could not be created. Try again.
                  </p>
                )}
              </form>

              {pairingOffer && (
                <div className="space-y-2 rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 p-3">
                  <p className="text-xs text-content-primary">
                    Share these values only with the Wardkeep deployment you want to pair. They
                    expire {new Date(pairingOffer.expiresAt).toLocaleString()}.
                  </p>
                  <label htmlFor="pairing-offer-id" className="input-label">
                    Offer ID
                  </label>
                  <input
                    id="pairing-offer-id"
                    readOnly
                    value={pairingOffer.offerId}
                    className="input text-xs"
                  />
                  <label htmlFor="pairing-offer-secret" className="input-label">
                    Pairing secret
                  </label>
                  <input
                    id="pairing-offer-secret"
                    readOnly
                    value={pairingOffer.secret}
                    className="input text-xs"
                  />
                </div>
              )}

              <form
                className="space-y-2 border-t border-edge pt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  connectPeerMutation.mutate();
                }}
              >
                <p className="text-xs text-content-secondary">
                  Connect to an offer created by the deployment that will store your encrypted
                  copies.
                </p>
                <label htmlFor="pairing-destination-name" className="input-label">
                  Destination name
                </label>
                <input
                  id="pairing-destination-name"
                  value={connectForm.peerName}
                  onChange={(event) =>
                    setConnectForm((current) => ({ ...current, peerName: event.target.value }))
                  }
                  required
                  maxLength={120}
                  placeholder="Destination name"
                  className="input"
                />
                <label htmlFor="pairing-local-name" className="input-label">
                  This deployment name
                </label>
                <input
                  id="pairing-local-name"
                  value={connectForm.localPeerName}
                  onChange={(event) =>
                    setConnectForm((current) => ({
                      ...current,
                      localPeerName: event.target.value,
                    }))
                  }
                  required
                  maxLength={120}
                  placeholder="This deployment name"
                  className="input"
                />
                <label htmlFor="pairing-destination-url" className="input-label">
                  Destination URL
                </label>
                <input
                  id="pairing-destination-url"
                  type="url"
                  value={connectForm.peerUrl}
                  onChange={(event) =>
                    setConnectForm((current) => ({ ...current, peerUrl: event.target.value }))
                  }
                  required
                  placeholder="https://destination.example"
                  className="input"
                />
                <label htmlFor="pairing-connect-offer-id" className="input-label">
                  Offer ID
                </label>
                <input
                  id="pairing-connect-offer-id"
                  value={connectForm.offerId}
                  onChange={(event) =>
                    setConnectForm((current) => ({ ...current, offerId: event.target.value }))
                  }
                  required
                  placeholder="Offer ID"
                  className="input"
                />
                <label htmlFor="pairing-connect-secret" className="input-label">
                  Pairing secret
                </label>
                <input
                  id="pairing-connect-secret"
                  value={connectForm.secret}
                  onChange={(event) =>
                    setConnectForm((current) => ({ ...current, secret: event.target.value }))
                  }
                  required
                  placeholder="Pairing secret"
                  className="input"
                />
                <button
                  type="submit"
                  className="btn-secondary text-xs"
                  disabled={connectPeerMutation.isPending}
                >
                  {connectPeerMutation.isPending ? 'Pairing…' : 'Pair destination'}
                </button>
                {connectPeerMutation.isError && (
                  <p className="text-xs text-accent-red">
                    The destination could not be paired. Check the URL and offer, then try again.
                  </p>
                )}
              </form>
            </div>
          </details>
          {remotePeersQuery.data?.map((peer) => (
            <div
              key={peer.id}
              className="flex items-center justify-between gap-3 border-t border-edge pt-2 first:border-0 first:pt-0"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={
                      peer.status === 'PAIRED'
                        ? 'h-2 w-2 rounded-full bg-accent-green'
                        : peer.status === 'UNREACHABLE'
                          ? 'h-2 w-2 rounded-full bg-accent-red'
                          : 'h-2 w-2 rounded-full bg-accent-yellow'
                    }
                    aria-hidden="true"
                  />
                  <p className="truncate text-sm text-content-primary">{peer.peerName}</p>
                </div>
                <p className="truncate text-xs text-content-secondary">
                  {peer.status === 'PAIRED'
                    ? peer.lastSyncAt
                      ? `Last copy ${new Date(peer.lastSyncAt).toLocaleString()}`
                      : 'Ready for an encrypted copy'
                    : peer.status === 'UNREACHABLE'
                      ? 'Destination is unreachable; Wardkeep will retry automatically'
                      : peer.status === 'PENDING'
                        ? 'Pairing is pending'
                        : 'Stopped'}
                </p>
                {peer.lastError && <p className="mt-1 text-xs text-accent-red">{peer.lastError}</p>}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {peer.status === 'PAIRED' &&
                  peer.direction !== 'PULL' &&
                  backupsQuery.data?.[0] && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={pushBackupMutation.isPending}
                      onClick={() => {
                        const backup = backupsQuery.data![0];
                        const label = backup.isAutomated
                          ? 'This automatic backup can only be restored by this same deployment.'
                          : 'You will still need the manual backup passphrase to restore it.';
                        if (
                          window.confirm(
                            `Send the latest encrypted backup to ${peer.peerName}? ${label}`,
                          )
                        )
                          pushBackupMutation.mutate({ peerId: peer.id, backupId: backup.id });
                      }}
                    >
                      <DatabaseBackup size={14} />{' '}
                      {pushBackupMutation.isPending ? 'Sending…' : 'Send latest'}
                    </button>
                  )}
                {peer.status === 'PAIRED' && peer.direction === 'PULL' && (
                  <span className="text-xs text-content-tertiary">Receive only</span>
                )}
                {peer.status === 'PAIRED' && peer.direction !== 'PULL' && (
                  <label className="text-xs text-content-secondary">
                    <span className="sr-only">Automatic copy schedule</span>
                    <select
                      className="input h-8 py-1 text-xs"
                      value={peer.syncSchedule ?? ''}
                      disabled={setRemoteSyncScheduleMutation.isPending}
                      onChange={(event) =>
                        setRemoteSyncScheduleMutation.mutate({
                          peerId: peer.id,
                          schedule: event.target.value
                            ? (event.target.value as NonNullable<RemoteBackupPeer['syncSchedule']>)
                            : null,
                        })
                      }
                    >
                      <option value="">Manual copies</option>
                      <option value="HOURLY">Copy hourly</option>
                      <option value="EVERY_6H">Copy every 6 hours</option>
                      <option value="DAILY">Copy daily</option>
                      <option value="WEEKLY">Copy weekly</option>
                    </select>
                  </label>
                )}
                {peer.status === 'PAIRED' && (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => {
                      setRemoteBackupPeerId(peer.id);
                      setRemoteRestoreTarget(null);
                      setRemoteRestorePassphrase('');
                    }}
                  >
                    Browse copies
                  </button>
                )}
                {peer.status !== 'REVOKED' && (
                  <button
                    type="button"
                    className="btn-secondary text-xs text-accent-red"
                    disabled={revokePeerMutation.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Stop using ${peer.peerName} as an off-site destination? Existing encrypted copies will remain there.`,
                        )
                      )
                        revokePeerMutation.mutate(peer.id);
                    }}
                  >
                    {revokePeerMutation.isPending ? 'Stopping…' : 'Stop using'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {remoteBackupPeerId && (
            <div className="space-y-2 border-t border-edge pt-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-content-primary">Remote backup copies</p>
                <button
                  type="button"
                  className="text-xs text-content-secondary underline"
                  onClick={() => {
                    setRemoteBackupPeerId(null);
                    setRemoteRestoreTarget(null);
                    setRemoteRestorePassphrase('');
                  }}
                >
                  Close
                </button>
              </div>
              {remoteBackupsQuery.isLoading && <div className="skeleton h-12 w-full" />}
              {remoteBackupsQuery.isError && (
                <p className="text-xs text-accent-red">Could not retrieve remote backup copies.</p>
              )}
              {remoteBackupsQuery.data?.length === 0 && (
                <p className="text-xs text-content-secondary">
                  No encrypted copies are stored there.
                </p>
              )}
              {remoteBackupsQuery.data?.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-edge p-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-content-primary">
                      {backup.recoveryClass === 'PORTABLE_MANUAL'
                        ? 'Portable manual backup'
                        : 'Source-tied automatic backup'}
                    </p>
                    <p className="mt-1 text-xs text-content-secondary">
                      {new Date(backup.createdAt).toLocaleString()} ·{' '}
                      {(backup.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary shrink-0 text-xs"
                    onClick={() => setRemoteRestoreTarget(backup)}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                </div>
              ))}
            </div>
          )}
          {pushBackupMutation.isError && (
            <p className="text-xs text-accent-red">
              Encrypted copy could not be sent. The local backup is unchanged.
            </p>
          )}
          {pushBackupMutation.isSuccess && (
            <p className="text-xs text-accent-green">
              Encrypted copy sent to the paired destination.
            </p>
          )}
          {revokePeerMutation.isError && (
            <p className="text-xs text-accent-red">
              The off-site destination could not be stopped. No copies were removed.
            </p>
          )}
        </div>

        {remoteRestoreTarget && (
          <form
            onSubmit={handleRemoteRestoreBackup}
            className="space-y-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 p-3"
          >
            <p className="text-sm font-medium text-content-primary">Restore remote backup?</p>
            <p className="text-xs text-content-secondary">
              This downloads a verified encrypted copy and replaces the household data currently in
              Wardkeep.
            </p>
            {remoteRestoreTarget.recoveryClass === 'PORTABLE_MANUAL' ? (
              <input
                type="password"
                value={remoteRestorePassphrase}
                onChange={(event) => setRemoteRestorePassphrase(event.target.value)}
                minLength={12}
                required
                placeholder="Manual backup passphrase"
                className="input"
              />
            ) : (
              <p className="text-xs text-content-secondary">
                This source-tied automatic backup requires the original deployment&apos;s
                scheduled-backup key.
              </p>
            )}
            {restoreRemoteBackupMutation.isError && (
              <p className="text-xs text-accent-red">{restoreRemoteBackupMutation.error.message}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={
                  restoreRemoteBackupMutation.isPending ||
                  (remoteRestoreTarget.recoveryClass === 'PORTABLE_MANUAL' &&
                    remoteRestorePassphrase.length < 12)
                }
              >
                <RotateCcw size={16} />{' '}
                {restoreRemoteBackupMutation.isPending ? 'Restoring…' : 'Restore remote backup'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setRemoteRestoreTarget(null);
                  setRemoteRestorePassphrase('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {restoreTarget && (
          <form
            onSubmit={handleRestoreBackup}
            className="space-y-3 rounded-lg border border-accent-yellow/30 bg-accent-yellow/5 p-3"
          >
            <p className="text-sm font-medium text-content-primary">
              Restore {restoreTarget.isAutomated ? 'automatic' : 'manual'} backup?
            </p>
            <p className="text-xs text-content-secondary">
              This replaces the data currently stored for this household. This cannot be undone.
            </p>
            {!restoreTarget.isAutomated && (
              <input
                type="password"
                value={restorePassphrase}
                onChange={(event) => setRestorePassphrase(event.target.value)}
                minLength={12}
                required
                placeholder="Manual backup passphrase"
                className="input"
              />
            )}
            {restoreBackupMutation.isError && (
              <p className="text-xs text-accent-red">{restoreBackupMutation.error.message}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={
                  restoreBackupMutation.isPending ||
                  (!restoreTarget.isAutomated && restorePassphrase.length < 12)
                }
              >
                <RotateCcw size={16} />{' '}
                {restoreBackupMutation.isPending ? 'Restoring…' : 'Restore backup'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setRestoreTarget(null);
                  setRestorePassphrase('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="card max-w-xl space-y-4" aria-labelledby="capabilities-heading">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-blue/10">
            <Power size={16} className="text-accent-blue" />
          </div>
          <div>
            <h2 id="capabilities-heading" className="card-title mb-0">
              HOUSEHOLD CAPABILITIES
            </h2>
            <p className="mt-1 text-xs text-content-secondary">
              Choose which parts of your household information Wardkeep uses in your household
              picture.
            </p>
          </div>
        </div>
        {capabilitiesQuery.isLoading && (
          <div className="space-y-2">
            <div className="skeleton h-16 w-full" />
            <div className="skeleton h-16 w-full" />
          </div>
        )}
        {capabilitiesQuery.isError && (
          <p className="text-sm text-accent-red">{capabilitiesQuery.error.message}</p>
        )}
        {capabilitiesQuery.data?.map((capability) => (
          <div
            key={capability.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-edge bg-surface-secondary p-3"
          >
            <div>
              <p className="text-sm font-medium text-content-primary">{capability.name}</p>
              <p className="mt-1 text-xs text-content-secondary">{capability.description}</p>
              <p className="mt-1 text-xs text-content-tertiary">{capability.pillars.join(' · ')}</p>
            </div>
            <button
              type="button"
              className={capability.isEnabled ? 'btn-secondary shrink-0' : 'btn-primary shrink-0'}
              disabled={capabilityMutation.isPending}
              onClick={() =>
                capabilityMutation.mutate({ id: capability.id, enable: !capability.isEnabled })
              }
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
