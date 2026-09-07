'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type MemoryKind = 'USER_PREFERENCE' | 'ANNUAL_EVENT' | 'SEASONAL_PATTERN' | 'RECOMMENDATION_OUTCOME';
type Memory = { id: string; kind: MemoryKind; summary: string; sourceRefs: string[]; observedAt: string; expiresAt: string | null };
const labels: Record<MemoryKind, string> = {
  USER_PREFERENCE: 'Preference', ANNUAL_EVENT: 'Annual event', SEASONAL_PATTERN: 'Seasonal pattern', RECOMMENDATION_OUTCOME: 'Recommendation outcome',
};

export default function AdvisorMemoryPage() {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<MemoryKind>('USER_PREFERENCE');
  const [summary, setSummary] = useState('');
  const [sourceRefs, setSourceRefs] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const memories = useQuery({ queryKey: ['advisor-memory'], queryFn: () => apiClient.get<Memory[]>('/advisor/memory') });
  const create = useMutation({
    mutationFn: () => apiClient.post('/advisor/memory', {
      kind,
      summary,
      ...(sourceRefs.trim() ? { sourceRefs: sourceRefs.split(',').map((source) => source.trim()).filter(Boolean) } : {}),
      ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T00:00:00.000Z`).toISOString() } : {}),
    }),
    onSuccess: () => { setSummary(''); setSourceRefs(''); setExpiresAt(''); queryClient.invalidateQueries({ queryKey: ['advisor-memory'] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/advisor/memory/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['advisor-memory'] }),
  });
  return <div className="max-w-3xl space-y-6">
    <div><div className="flex items-center gap-2"><Brain className="text-accent-blue" size={22} /><h1 className="text-page-title">Advisor memory</h1></div><p className="mt-2 text-sm text-content-secondary">Local household context only. Entries are visible, reversible, and never sent to a cloud model.</p></div>
    <form className="card space-y-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <label className="input-label">Memory type<select className="input mt-1" value={kind} onChange={(event) => setKind(event.target.value as MemoryKind)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="input-label">Concise factual note<textarea className="input mt-1 min-h-24" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={1000} required /></label>
      <label className="input-label">Source references <span className="normal-case">(optional, comma separated)</span><input className="input mt-1" value={sourceRefs} onChange={(event) => setSourceRefs(event.target.value)} maxLength={3200} placeholder="e.g. statement:2026-08, event:family-birthday" /></label>
      <label className="input-label">Expires on <span className="normal-case">(optional)</span><input className="input mt-1" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
      {create.isError && <p className="text-sm text-accent-red">Memory could not be saved.</p>}
      <button className="btn-primary" disabled={create.isPending || !summary.trim()}>{create.isPending ? 'Saving…' : 'Save local memory'}</button>
    </form>
    <section className="card space-y-3"><p className="card-title">Active memory</p>{memories.isLoading && <div className="skeleton h-16" />}{memories.data?.length === 0 && <p className="text-sm text-content-secondary">No active memory entries.</p>}{memories.data?.map((memory) => <article key={memory.id} className="flex justify-between gap-4 border-t border-edge pt-3 first:border-0 first:pt-0"><div><p className="text-xs text-accent-blue">{labels[memory.kind]}</p><p className="mt-1 text-sm text-content-primary">{memory.summary}</p><p className="mt-1 text-xs text-content-tertiary">Observed {new Date(memory.observedAt).toLocaleDateString()}{memory.expiresAt ? ` · expires ${new Date(memory.expiresAt).toLocaleDateString()}` : ''}</p>{memory.sourceRefs.length > 0 && <p className="mt-1 text-xs text-content-secondary">Sources: {memory.sourceRefs.join(' · ')}</p>}</div><button className="btn-ghost shrink-0 text-accent-red" onClick={() => remove.mutate(memory.id)} aria-label={`Delete memory: ${memory.summary}`}><Trash2 size={16} /></button></article>)}</section>
  </div>;
}
