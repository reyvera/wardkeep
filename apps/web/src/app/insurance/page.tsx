'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type PolicyType =
  'AUTO' | 'HOME' | 'RENTERS' | 'HEALTH' | 'LIFE' | 'DISABILITY' | 'UMBRELLA' | 'OTHER';
interface Policy {
  id: string;
  type: PolicyType;
  provider: string;
  nickname: string | null;
  premium: string | null;
  premiumFrequency: string;
  paymentArrangement: string;
  paymentAccountId: string | null;
  paymentAccount: { name: string } | null;
  propertyTaxEscrow: string | null;
  deductible: string | null;
  coverageAmount: string | null;
  renewalDate: string | null;
  isActive: boolean;
}
interface Account {
  id: string;
  name: string;
  type: string;
}
const TYPES: PolicyType[] = [
  'AUTO',
  'HOME',
  'RENTERS',
  'HEALTH',
  'LIFE',
  'DISABILITY',
  'UMBRELLA',
  'OTHER',
];
const label = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const emptyForm = {
  type: 'AUTO' as PolicyType,
  provider: '',
  nickname: '',
  renewalDate: '',
  premium: '',
  deductible: '',
  coverageAmount: '',
  paymentArrangement: 'SEPARATE',
  paymentAccountId: '',
  propertyTaxEscrow: '',
};

export default function InsurancePage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Policy | null>(null);
  const policies = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: () => apiClient.get<Policy[]>('/insurance/policies'),
  });
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts'),
  });
  const save = useMutation({
    mutationFn: () =>
      editing
        ? apiClient.patch(
            `/insurance/policies/${editing.id}`,
            Object.fromEntries(Object.entries(form).filter(([, value]) => value !== '')),
          )
        : apiClient.post(
            '/insurance/policies',
            Object.fromEntries(Object.entries(form).filter(([, value]) => value !== '')),
          ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['insurance-policies'] });
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/insurance/policies/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['insurance-policies'] }),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-page-title">Insurance policies</h1>
          <p className="mt-1 max-w-2xl text-sm text-content-secondary">
            Keep policy details and renewal dates in one place. Wardkeep tracks renewal timing; it
            does not yet determine whether your coverage is adequate.
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
          Add policy
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="card grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="input-label">Policy type</label>
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as PolicyType })}
            >
              {TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Provider</label>
            <input
              className="input"
              required
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              placeholder="e.g. State Farm"
            />
          </div>
          <div>
            <label className="input-label">Nickname (optional)</label>
            <input
              className="input"
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              placeholder="Family car"
            />
          </div>
          <div>
            <label className="input-label">Renewal date (optional)</label>
            <input
              className="input"
              type="date"
              value={form.renewalDate}
              onChange={(e) => setForm({ ...form, renewalDate: e.target.value })}
            />
          </div>
          <div>
            <label className="input-label">Premium (optional)</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.premium}
              onChange={(e) => setForm({ ...form, premium: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="input-label">Deductible (optional)</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.deductible}
              onChange={(e) => setForm({ ...form, deductible: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="input-label">Coverage amount (optional)</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.coverageAmount}
              onChange={(e) => setForm({ ...form, coverageAmount: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="input-label">How is this premium paid?</label>
            <select
              className="input"
              value={form.paymentArrangement}
              onChange={(e) => setForm({ ...form, paymentArrangement: e.target.value })}
            >
              <option value="SEPARATE">Paid separately</option>
              <option value="MORTGAGE_ESCROW">Included in mortgage escrow</option>
              <option value="LOAN_OR_LEASE">Included in loan or lease payment</option>
              <option value="OTHER_BUNDLED">Included in another payment</option>
            </select>
          </div>
          {form.paymentArrangement !== 'SEPARATE' && (
            <>
              <div>
                <label className="input-label">Bundled payment account</label>
                <select
                  className="input"
                  required
                  value={form.paymentAccountId}
                  onChange={(e) => setForm({ ...form, paymentAccountId: e.target.value })}
                >
                  <option value="">Select an account</option>
                  {accounts.data?.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} · {label(account.type)}
                    </option>
                  ))}
                </select>
              </div>
              {form.type === 'HOME' && (
                <div>
              <label className="input-label">Monthly property-tax escrow (optional)</label>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={form.propertyTaxEscrow}
                    onChange={(e) => setForm({ ...form, propertyTaxEscrow: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              )}
            </>
          )}
          <div className="flex items-end gap-2">
            <button className="btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Save policy'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {save.isError && (
            <p className="text-sm text-accent-red md:col-span-2">
              Unable to save this policy. Check the entered values and try again.
            </p>
          )}
        </form>
      )}
      {policies.isLoading && (
        <div className="card">
          <div className="skeleton h-24 w-full" />
        </div>
      )}
      {policies.data?.length === 0 && (
        <div className="card py-12 text-center">
          <ShieldCheck size={40} className="mx-auto mb-3 text-content-tertiary" />
          <p className="text-sm text-content-secondary">No policies recorded yet</p>
          <p className="mt-1 text-xs text-content-tertiary">
            Adding a policy lets Wardkeep flag approaching renewals. Missing policy types remain
            unknown.
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {policies.data?.map((policy) => (
          <article key={policy.id} className="card">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-blue/10">
                <ShieldCheck size={18} className="text-accent-blue" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-content-primary">
                      {policy.nickname || label(policy.type)}
                    </p>
                    <p className="text-sm text-content-secondary">
                      {policy.provider} · {label(policy.type)}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(policy);
                        setForm({
                          type: policy.type,
                          provider: policy.provider,
                          nickname: policy.nickname ?? '',
                          renewalDate: policy.renewalDate?.slice(0, 10) ?? '',
                          premium: policy.premium ?? '',
                          deductible: policy.deductible ?? '',
                          coverageAmount: policy.coverageAmount ?? '',
                          paymentArrangement: policy.paymentArrangement,
                          paymentAccountId: policy.paymentAccountId ?? '',
                          propertyTaxEscrow: policy.propertyTaxEscrow ?? '',
                        });
                        setOpen(true);
                      }}
                      className="btn-ghost p-1 text-content-tertiary hover:text-accent-blue"
                      aria-label={`Edit ${policy.provider} policy`}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => remove.mutate(policy.id)}
                      className="btn-ghost p-1 text-content-tertiary hover:text-accent-red"
                      aria-label={`Delete ${policy.provider} policy`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-content-secondary">
                  <span>
                    Renewal
                    <br />
                    <b className="text-content-primary">
                      {policy.renewalDate
                        ? new Date(policy.renewalDate).toLocaleDateString()
                        : 'Not recorded'}
                    </b>
                  </span>
                  <span>
                    Premium
                    <br />
                    <b className="text-content-primary">
                      {policy.premium
                        ? `$${policy.premium} / ${policy.premiumFrequency.toLowerCase()}`
                        : 'Not recorded'}
                    </b>
                  </span>
                  {policy.paymentArrangement !== 'SEPARATE' && (
                    <span className="col-span-2">
                      Payment
                      <br />
                      <b className="text-content-primary">
                        Included in {policy.paymentAccount?.name ?? 'a bundled payment'}
                        {policy.propertyTaxEscrow
                          ? ` · $${policy.propertyTaxEscrow} property-tax escrow`
                          : ''}
                      </b>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
