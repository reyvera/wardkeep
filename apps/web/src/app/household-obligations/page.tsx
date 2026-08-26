'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';

import { apiClient } from '@/lib/api-client';

interface HouseholdObligation {
  id: string;
  name: string;
  monthlyAmount: string;
  isVariable: boolean;
  reviewDate: string | null;
  notes: string | null;
  isActive: boolean;
}

const emptyForm = {
  name: '',
  monthlyAmount: '',
  isVariable: false,
  reviewDate: '',
  notes: '',
};

export default function HouseholdObligationsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<HouseholdObligation | null>(null);
  const obligations = useQuery({
    queryKey: ['household-obligations'],
    queryFn: () => apiClient.get<HouseholdObligation[]>('/household-obligations'),
  });
  const save = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        reviewDate: form.reviewDate || (editing ? null : undefined),
        notes: form.notes || (editing ? null : undefined),
      };
      return editing
        ? apiClient.patch(`/household-obligations/${editing.id}`, payload)
        : apiClient.post('/household-obligations', payload);
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['household-obligations'] });
      setForm(emptyForm);
      setEditing(null);
      setOpen(false);
    },
  });
  const update = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/household-obligations/${id}`, { isActive }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['household-obligations'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/household-obligations/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['household-obligations'] }),
  });
  const activeObligations = (obligations.data ?? []).filter((obligation) => obligation.isActive);
  const monthlyTotal = activeObligations.reduce(
    (total, obligation) => total + Number(obligation.monthlyAmount),
    0,
  );

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-page-title">External funding commitments</h1>
          <p className="mt-1 max-w-2xl text-sm text-content-secondary">
            Record regular money sent to an account or person outside Wardkeep’s tracked financial
            picture. Do not add expenses already tracked through your budget, transactions, or
            recurring bills. Variable amounts are treated as your estimates.
          </p>
        </div>
        <button
          className="btn-primary w-fit"
          onClick={() => {
            setEditing(null);
            setForm(emptyForm);
            setOpen(!open);
          }}
        >
          <Plus size={16} />
          Add commitment
        </button>
      </div>

      {activeObligations.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="card py-4">
            <p className="card-title">EXTERNAL MONTHLY COMMITMENTS</p>
            <p className="text-2xl font-bold text-content-primary">${monthlyTotal.toFixed(2)}</p>
          </div>
          <div className="card py-4">
            <p className="card-title">VARIABLE ESTIMATES</p>
            <p className="text-2xl font-bold text-content-primary">
              {activeObligations.filter((obligation) => obligation.isVariable).length}
            </p>
          </div>
        </div>
      )}

      {open && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="input-label">External commitment</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Monthly transfer to an external grocery account"
            />
          </div>
          <div>
            <label className="input-label">Expected monthly amount</label>
            <input
              className="input"
              required
              inputMode="decimal"
              value={form.monthlyAmount}
              onChange={(event) => setForm({ ...form, monthlyAmount: event.target.value })}
              placeholder="0.00"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={form.isVariable}
              onChange={(event) => setForm({ ...form, isVariable: event.target.checked })}
            />
            This is a variable monthly estimate
          </label>
          <div>
            <label className="input-label">Review date (optional)</label>
            <input
              className="input"
              type="date"
              value={form.reviewDate}
              onChange={(event) => setForm({ ...form, reviewDate: event.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="input-label">Notes (optional)</label>
            <textarea
              className="input min-h-20 resize-y"
              maxLength={1000}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Save commitment'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditing(null);
                setOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {obligations.data?.length === 0 && (
        <div className="card py-12 text-center text-sm text-content-secondary">
          No external commitments recorded. Use this only for money sent outside Wardkeep’s tracked
          accounts; regular tracked spending belongs in your budget and transactions.
        </div>
      )}

      <div className="space-y-3">
        {obligations.data?.map((obligation) => (
          <article key={obligation.id} className={`card ${obligation.isActive ? '' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-content-primary">{obligation.name}</p>
                <p className="mt-1 text-sm text-content-secondary">
                  ${obligation.monthlyAmount} / month
                  {obligation.isVariable ? ' · Variable estimate' : ''}
                  {obligation.reviewDate
                    ? ` · Review ${new Date(obligation.reviewDate).toLocaleDateString()}`
                    : ''}
                </p>
                {obligation.notes && (
                  <p className="mt-2 text-sm text-content-tertiary">{obligation.notes}</p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  className="btn-ghost p-1 text-content-tertiary hover:text-accent-blue"
                  onClick={() => {
                    setEditing(obligation);
                    setForm({
                      name: obligation.name,
                      monthlyAmount: obligation.monthlyAmount,
                      isVariable: obligation.isVariable,
                      reviewDate: obligation.reviewDate?.slice(0, 10) ?? '',
                      notes: obligation.notes ?? '',
                    });
                    setOpen(true);
                  }}
                  aria-label={`Edit ${obligation.name}`}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="btn-ghost p-1 text-content-tertiary hover:text-accent-blue"
                  onClick={() => update.mutate({ id: obligation.id, isActive: !obligation.isActive })}
                  aria-label={obligation.isActive ? `Archive ${obligation.name}` : `Restore ${obligation.name}`}
                >
                  {obligation.isActive ? <Archive size={16} /> : <RotateCcw size={16} />}
                </button>
                <button
                  className="btn-ghost p-1 text-content-tertiary hover:text-accent-red"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${obligation.name} permanently? You can archive it instead if you may need it later.`,
                      )
                    ) {
                      remove.mutate(obligation.id);
                    }
                  }}
                  aria-label={`Delete ${obligation.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
