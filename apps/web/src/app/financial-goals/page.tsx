'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Trash2 } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

type Goal = {
  id: string;
  name: string;
  targetAmount: string | null;
  savedAmount: string;
  targetDate: string | null;
  isActive: boolean;
};

export default function FinancialGoalsPage() {
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const goals = useQuery({ queryKey: ['financial-goals'], queryFn: () => apiClient.get<Goal[]>('/financial-goals') });
  const refresh = () => client.invalidateQueries({ queryKey: ['financial-goals'] });
  const create = useMutation({
    mutationFn: () => apiClient.post('/financial-goals', {
      name,
      targetAmount: targetAmount || null,
      savedAmount: savedAmount || '0',
      targetDate: targetDate || null,
    }),
    onSuccess: () => { setName(''); setTargetAmount(''); setSavedAmount(''); setTargetDate(''); refresh(); },
  });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: object }) => apiClient.patch(`/financial-goals/${id}`, body), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => apiClient.delete(`/financial-goals/${id}`), onSuccess: refresh });

  return <div className="space-y-6">
    <div><h1 className="text-page-title">Financial goals</h1><p className="mt-1 text-sm text-content-secondary">Record a target, the amount you have set aside, and a target date. Wardkeep does not infer goal progress from your accounts.</p></div>
    <form className="card grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div className="sm:col-span-2"><label className="input-label">Goal name</label><input className="input" value={name} onChange={(event) => setName(event.target.value)} required placeholder="e.g. Family vacation" /></div>
      <div><label className="input-label">Target amount (optional)</label><input className="input" inputMode="decimal" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="0.00" /></div>
      <div><label className="input-label">Amount set aside</label><input className="input" inputMode="decimal" value={savedAmount} onChange={(event) => setSavedAmount(event.target.value)} placeholder="0.00" /></div>
      <div><label className="input-label">Target date (optional)</label><input className="input" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></div>
      <div className="flex items-end"><button className="btn-primary w-full" disabled={create.isPending}>Add goal</button></div>
    </form>
    {goals.isLoading ? <div className="card skeleton h-32" /> : goals.data?.length === 0 ? <div className="card py-12 text-center text-sm text-content-secondary">No financial goals recorded yet.</div> : <ul className="space-y-3">{goals.data?.map((goal) => {
      const target = goal.targetAmount ? Number(goal.targetAmount) : null; const saved = Number(goal.savedAmount); const progress = target && target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : null;
      return <li key={goal.id} className="card"><div className="flex gap-3"><Target className="mt-0.5 text-accent-purple" size={20} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-content-primary">{goal.name}</p><p className="mt-1 text-sm text-content-secondary">{target ? `$${saved.toLocaleString()} of $${target.toLocaleString()} recorded` : `$${saved.toLocaleString()} recorded`}{goal.targetDate ? ` · target ${new Date(goal.targetDate).toLocaleDateString()}` : ''}</p></div><button className="btn-ghost p-2 text-content-tertiary hover:text-accent-red" aria-label={`Delete ${goal.name}`} onClick={() => remove.mutate(goal.id)}><Trash2 size={16} /></button></div><div className="mt-4 max-w-xs"><label className="input-label">Amount set aside</label><input className="input" inputMode="decimal" defaultValue={goal.savedAmount} aria-label={`Amount set aside for ${goal.name}`} onBlur={(event) => { if (event.target.value !== goal.savedAmount) update.mutate({ id: goal.id, body: { savedAmount: event.target.value || '0' } }); }} /></div>{progress !== null && <><div className="progress-track mt-4"><div className="progress-fill bg-accent-purple" style={{ width: `${progress}%` }} /></div><p className="mt-1 text-xs text-content-tertiary">{progress}% recorded</p></>}<button className="btn-ghost mt-3 p-0 text-xs" onClick={() => update.mutate({ id: goal.id, body: { isActive: !goal.isActive } })}>{goal.isActive ? 'Archive goal' : 'Restore goal'}</button></div></div></li>;
    })}</ul>}
  </div>;
}
