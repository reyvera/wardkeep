'use client';

import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, FileText, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type DocumentType = 'WILL' | 'TRUST' | 'FINANCIAL_POWER_OF_ATTORNEY' | 'HEALTHCARE_DIRECTIVE' | 'BENEFICIARY_REVIEW' | 'OTHER';
interface EstateDocument {
  id: string;
  type: DocumentType;
  title: string | null;
  reviewDate: string | null;
  notes: string | null;
  isActive: boolean;
}
const TYPES: DocumentType[] = ['WILL', 'TRUST', 'FINANCIAL_POWER_OF_ATTORNEY', 'HEALTHCARE_DIRECTIVE', 'BENEFICIARY_REVIEW', 'OTHER'];
const label = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const emptyForm = { type: 'WILL' as DocumentType, title: '', reviewDate: '', notes: '' };

export default function EstateDocumentsPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const documents = useQuery({ queryKey: ['estate-documents'], queryFn: () => apiClient.get<EstateDocument[]>('/estate-documents') });
  const save = useMutation({
    mutationFn: () => apiClient.post('/estate-documents', Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ''))),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['estate-documents'] }); setForm(emptyForm); setOpen(false); },
  });
  const setActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiClient.patch(`/estate-documents/${id}`, { isActive }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['estate-documents'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/estate-documents/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['estate-documents'] }),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate(); };
  const activeDocuments = documents.data?.filter((document) => document.isActive) ?? [];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-page-title">Estate planning</h1><p className="mt-1 max-w-2xl text-sm text-content-secondary">Record which documents you keep and when to review them. Wardkeep does not store document contents or determine legal validity, beneficiary choices, or adequacy.</p></div>
      <button className="btn-primary w-fit" onClick={() => setOpen(!open)}><Plus size={16} />Add record</button>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="card py-4"><p className="card-title">ACTIVE RECORDS</p><p className="text-2xl font-bold text-content-primary">{activeDocuments.length}</p></div><div className="card py-4"><p className="card-title">WHAT THIS MEANS</p><p className="mt-1 text-sm text-content-secondary">A record is a reminder, not a legal assessment.</p></div></div>
    {open && <form onSubmit={submit} className="card grid grid-cols-1 gap-4 md:grid-cols-2">
      <div><label className="input-label">Document type</label><select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as DocumentType })}>{TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></div>
      <div><label className="input-label">Label (optional)</label><input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Family will" /></div>
      <div><label className="input-label">Next review date (optional)</label><input className="input" type="date" value={form.reviewDate} onChange={(event) => setForm({ ...form, reviewDate: event.target.value })} /></div>
      <div className="md:col-span-2"><label className="input-label">Notes (optional)</label><textarea className="input min-h-24" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Where to find it or what to confirm at the next review. Avoid sensitive document contents." /></div>
      <div className="flex gap-3 md:col-span-2"><button className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save record'}</button><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button></div>
    </form>}
    <div className="space-y-3">{documents.data?.map((document) => <article key={document.id} className={`card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${document.isActive ? '' : 'opacity-60'}`}>
      <div className="flex gap-3"><FileText className="mt-0.5 text-accent-blue" size={20} /><div><p className="font-medium text-content-primary">{document.title || label(document.type)}</p><p className="mt-1 text-sm text-content-secondary">{label(document.type)}{document.reviewDate ? ` · Review ${new Date(document.reviewDate).toLocaleDateString()}` : ' · No review date set'}</p>{document.notes && <p className="mt-1 text-xs text-content-tertiary">{document.notes}</p>}</div></div>
      <div className="flex gap-2"><button className="btn-secondary btn-sm" onClick={() => setActive.mutate({ id: document.id, isActive: !document.isActive })}>{document.isActive ? <><Archive size={14} />Archive</> : <><RotateCcw size={14} />Restore</>}</button><button className="btn-secondary btn-sm text-accent-red" onClick={() => remove.mutate(document.id)} aria-label={`Delete ${document.title || label(document.type)}`}><Trash2 size={14} /></button></div>
    </article>)}{documents.data?.length === 0 && <div className="card py-10 text-center text-sm text-content-secondary">No estate-planning records yet. Adding one helps you track review timing; it does not change what Wardkeep assumes about legal readiness.</div>}</div>
  </div>;
}
