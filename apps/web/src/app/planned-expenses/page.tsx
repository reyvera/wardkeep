'use client';
import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
interface PlannedExpense {
  id: string;
  name: string;
  amount: string | null;
  fundedAmount: string | null;
  dueDate: string | null;
  isActive: boolean;
}
export default function PlannedExpensesPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', fundedAmount: '', dueDate: '' });
  const expenses = useQuery({
    queryKey: ['planned-expenses'],
    queryFn: () => apiClient.get<PlannedExpense[]>('/planned-expenses'),
  });
  const refresh = () => {
    client.invalidateQueries({ queryKey: ['planned-expenses'] });
    client.invalidateQueries({ queryKey: ['readiness'] });
    client.invalidateQueries({ queryKey: ['timeline'] });
  };
  const save = useMutation({
    mutationFn: () =>
      apiClient.post(
        '/planned-expenses',
        Object.fromEntries(Object.entries(form).filter(([, value]) => value !== '')),
      ),
    onSuccess: () => {
      refresh();
      setForm({ name: '', amount: '', fundedAmount: '', dueDate: '' });
      setOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/planned-expenses/${id}`),
    onSuccess: refresh,
  });
  const fund = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) =>
      apiClient.patch(`/planned-expenses/${id}`, { fundedAmount: amount }),
    onSuccess: refresh,
  });
  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiClient.patch(`/planned-expenses/${id}`, { isActive }),
    onSuccess: refresh,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div>
          <h1 className="text-page-title">Planned expenses</h1>
          <p className="mt-1 max-w-2xl text-sm text-content-secondary">
            Track known future costs and the funds you explicitly set aside.
          </p>
        </div>
        <button className="btn-primary w-fit" onClick={() => setOpen(!open)}>
          <Plus size={16} />
          Add expense
        </button>
      </div>
      {open && (
        <form onSubmit={submit} className="card grid gap-4 md:grid-cols-2">
          <div>
            <label className="input-label">Expense name</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="input-label">Expected amount</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="input-label">Funds set aside</label>
            <input
              className="input"
              inputMode="decimal"
              value={form.fundedAmount}
              onChange={(e) => setForm({ ...form, fundedAmount: e.target.value })}
            />
          </div>
          <div>
            <label className="input-label">Due date</label>
            <input
              className="input"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <button className="btn-primary w-fit">Save expense</button>
        </form>
      )}
      <div className="space-y-3">
        {expenses.data?.map((expense) => (
          <div
            key={expense.id}
            className={`card flex items-center justify-between ${expense.isActive ? '' : 'opacity-70'}`}
          >
            <div>
              <p className="font-medium text-content-primary">{expense.name}</p>
              <p className="mt-1 text-sm text-content-secondary">
                {expense.amount ? `$${expense.amount}` : 'Amount not recorded'}
                {expense.fundedAmount ? ` · $${expense.fundedAmount} set aside` : ''}
                {expense.dueDate ? ` · Due ${new Date(expense.dueDate).toLocaleDateString()}` : ''}
                {!expense.isActive ? ' · No longer planned' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {expense.isActive &&
                expense.amount &&
                Number(expense.fundedAmount ?? 0) < Number(expense.amount) && (
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => fund.mutate({ id: expense.id, amount: expense.amount! })}
                  >
                    Mark funded
                  </button>
                )}
              <button
                className="btn-ghost p-2 text-content-tertiary hover:text-accent-yellow"
                onClick={() => setActive.mutate({ id: expense.id, isActive: !expense.isActive })}
                aria-label={`${expense.isActive ? 'Stop tracking' : 'Restore'} ${expense.name}`}
                title={expense.isActive ? 'Mark no longer planned' : 'Restore planned expense'}
              >
                {expense.isActive ? <CheckCircle2 size={16} /> : <RotateCcw size={16} />}
              </button>
              <button
                className="btn-ghost p-2 text-accent-red"
                onClick={() => remove.mutate(expense.id)}
                aria-label={`Remove ${expense.name}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
