'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCircle2, HeartHandshake, Trash2, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type Plan = { id: string; mode: 'INCAPACITY_CONTINUITY' | 'AFTER_DEATH_SETTLEMENT'; title: string; reviewDate: string | null; notes: string | null; isActive: boolean };
type Check = { id: string; label: string; recorded: boolean; detail: string };
type ReadinessCheck = { checks: Check[]; recordedCount: number; totalCount: number };
const label = (mode: Plan['mode']) => mode === 'INCAPACITY_CONTINUITY' ? 'Incapacity continuity plan' : 'After-death settlement plan';

export default function HouseholdTransitionsPage() {
  const client = useQueryClient();
  const [form, setForm] = useState({ mode: 'INCAPACITY_CONTINUITY' as Plan['mode'], title: '', reviewDate: '', notes: '' });
  const plans = useQuery({ queryKey: ['household-transitions'], queryFn: () => apiClient.get<Plan[]>('/household-transitions') });
  const readiness = useQuery({ queryKey: ['household-transitions', 'readiness-check'], queryFn: () => apiClient.get<ReadinessCheck>('/household-transitions/readiness-check') });
  const refresh = () => { client.invalidateQueries({ queryKey: ['household-transitions'] }); };
  const create = useMutation({ mutationFn: () => apiClient.post('/household-transitions', { ...form, reviewDate: form.reviewDate || null, notes: form.notes || null }), onSuccess: () => { setForm({ mode: 'INCAPACITY_CONTINUITY', title: '', reviewDate: '', notes: '' }); refresh(); } });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: object }) => apiClient.patch(`/household-transitions/${id}`, body), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => apiClient.delete(`/household-transitions/${id}`), onSuccess: refresh });

  return <div className="space-y-6">
    <div><h1 className="text-page-title">Household transition plans</h1><p className="mt-1 text-sm text-content-secondary">A neutral organizer for continuity planning and after-death settlement preparation. Recording a plan does not establish incapacity, death, legal authority, or access for anyone.</p></div>
    <div className="card border-accent-yellow/30 bg-accent-yellow/5 text-sm text-content-secondary">Store planning notes and locations—not legal, identity, medical, funeral, or financial-document contents. No plan here changes accounts, authentication, ownership, or permissions.</div>
    <section className="card" aria-labelledby="record-check-heading">
      <div className="flex items-start justify-between gap-3"><div><h2 id="record-check-heading" className="card-title mb-1">WHAT YOU HAVE ON FILE</h2><p className="text-sm text-content-secondary">{readiness.data ? `Wardkeep found ${readiness.data.recordedCount} of ${readiness.data.totalCount} kinds of information.` : 'Checking what you have entered…'}</p></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{readiness.data?.checks.map((check) => <div key={check.id} className="rounded-lg border border-edge bg-surface-secondary p-3"><div className="flex items-center gap-2 text-sm font-medium text-content-primary">{check.recorded ? <CheckCircle2 size={16} className="text-accent-green" /> : <XCircle size={16} className="text-accent-yellow" />}{check.label}</div><p className="mt-1 text-xs text-content-secondary">{check.detail}</p></div>)}</div>
    </section>
    <form className="card grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}><div><label className="input-label">Plan type</label><select className="input" value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value as Plan['mode'] })}><option value="INCAPACITY_CONTINUITY">Incapacity continuity</option><option value="AFTER_DEATH_SETTLEMENT">After-death settlement</option></select></div><div><label className="input-label">Plan title</label><input className="input" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Household continuity review" /></div><div><label className="input-label">Review date (optional)</label><input className="input" type="date" value={form.reviewDate} onChange={(event) => setForm({ ...form, reviewDate: event.target.value })} /></div><div className="flex items-end"><button className="btn-primary w-full" disabled={create.isPending}>Add plan</button></div></form>
    {plans.isLoading ? <div className="card skeleton h-32" /> : plans.data?.length === 0 ? <div className="card py-12 text-center text-sm text-content-secondary">No transition plans recorded yet.</div> : <ul className="space-y-3">{plans.data?.map((plan) => <li key={plan.id} className="card"><div className="flex gap-3"><HeartHandshake className="mt-0.5 text-accent-purple" size={20} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-content-primary">{plan.title}</p><p className="mt-1 text-sm text-content-secondary">{label(plan.mode)}{plan.reviewDate ? ` · review ${new Date(plan.reviewDate).toLocaleDateString()}` : ''}</p>{plan.notes && <p className="mt-2 text-xs text-content-tertiary">{plan.notes}</p>}</div><button className="btn-ghost p-2 text-content-tertiary hover:text-accent-red" onClick={() => remove.mutate(plan.id)} aria-label={`Delete ${plan.title}`}><Trash2 size={16} /></button></div><button className="btn-secondary mt-3 text-xs" onClick={() => update.mutate({ id: plan.id, body: { isActive: !plan.isActive } })}><Archive size={14} />{plan.isActive ? 'Archive plan' : 'Restore plan'}</button></div></div></li>)}</ul>}
  </div>;
}
