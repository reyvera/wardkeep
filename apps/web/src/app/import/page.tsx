'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Upload, FileUp, Eye, CheckCircle } from 'lucide-react';

interface PreviewTransaction { date: string; merchant: string; amount: number; category?: string; }
interface ImportResult { imported: number; duplicates: number; errors: number; }

function formatCurrency(value: number): string { return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function ImportPage() {
  const [format, setFormat] = useState<'csv' | 'ofx' | 'qfx'>('csv');
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState({ date: 'date', merchant: 'description', amount: 'amount', category: 'category' });
  const [preview, setPreview] = useState<PreviewTransaction[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const previewMutation = useMutation({ mutationFn: () => apiClient.post<{ transactions: PreviewTransaction[] }>('/import/preview', { fileData, format, columnMapping: format === 'csv' ? columnMapping : undefined }), onSuccess: (data) => setPreview(data.transactions.slice(0, 10)) });
  const commitMutation = useMutation({ mutationFn: () => apiClient.post<ImportResult>('/import/commit', { fileData, format, columnMapping: format === 'csv' ? columnMapping : undefined }), onSuccess: (data) => { setImportResult(data); setPreview([]); } });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setImportResult(null); setPreview([]);
    const reader = new FileReader();
    reader.onload = () => { const result = reader.result as string; setFileData(result.split(',')[1] ?? result); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-page-title text-content-primary">Import Transactions</h1>

      <div className="card space-y-4">
        <span className="card-title">FILE UPLOAD</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="input-label">Format</label><select value={format} onChange={(e) => setFormat(e.target.value as 'csv' | 'ofx' | 'qfx')} className="input"><option value="csv">CSV</option><option value="ofx">OFX</option><option value="qfx">QFX</option></select></div>
          <div><label className="input-label">File</label><input type="file" accept=".csv,.ofx,.qfx" onChange={handleFileChange} className="input file:mr-4 file:rounded-md file:border-0 file:bg-accent-blue/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-accent-blue cursor-pointer" /></div>
        </div>
        {fileName && <div className="flex items-center gap-2 text-sm text-content-secondary"><FileUp size={14} className="text-accent-blue" /><span>{fileName}</span></div>}

        {format === 'csv' && (
          <div className="space-y-3">
            <span className="card-title">COLUMN MAPPING</span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="input-label">Date</label><input value={columnMapping.date} onChange={(e) => setColumnMapping({ ...columnMapping, date: e.target.value })} className="input" /></div>
              <div><label className="input-label">Merchant</label><input value={columnMapping.merchant} onChange={(e) => setColumnMapping({ ...columnMapping, merchant: e.target.value })} className="input" /></div>
              <div><label className="input-label">Amount</label><input value={columnMapping.amount} onChange={(e) => setColumnMapping({ ...columnMapping, amount: e.target.value })} className="input" /></div>
              <div><label className="input-label">Category</label><input value={columnMapping.category} onChange={(e) => setColumnMapping({ ...columnMapping, category: e.target.value })} className="input" /></div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={() => previewMutation.mutate()} disabled={!fileData || previewMutation.isPending} className="btn-primary"><Eye size={16} /> {previewMutation.isPending ? 'Loading...' : 'Preview'}</button>
          {preview.length > 0 && <button onClick={() => commitMutation.mutate()} disabled={commitMutation.isPending} className="btn-primary"><Upload size={16} /> {commitMutation.isPending ? 'Importing...' : 'Commit Import'}</button>}
        </div>
        {previewMutation.isError && <p className="text-sm text-accent-red">{previewMutation.error.message}</p>}
      </div>

      {importResult && (
        <div className="card border-accent-green/30">
          <div className="flex items-center gap-3 mb-3"><CheckCircle size={18} className="text-accent-green" /><span className="text-sm font-medium text-accent-green">Import Complete</span></div>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-xs text-content-tertiary">Imported</p><p className="text-lg font-bold tabular-nums text-accent-green">{importResult.imported}</p></div>
            <div><p className="text-xs text-content-tertiary">Duplicates Skipped</p><p className="text-lg font-bold tabular-nums text-accent-yellow">{importResult.duplicates}</p></div>
            <div><p className="text-xs text-content-tertiary">Errors</p><p className="text-lg font-bold tabular-nums text-accent-red">{importResult.errors}</p></div>
          </div>
        </div>
      )}

      {preview.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="px-6 pt-6 pb-3"><span className="card-title">PREVIEW (FIRST 10 ROWS)</span></div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-t border-b border-edge"><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase">Date</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase">Merchant</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase text-right">Amount</th><th className="px-6 py-3 text-xs font-medium text-content-tertiary uppercase">Category</th></tr></thead>
              <tbody className="divide-y divide-edge">
                {preview.map((tx, i) => <tr key={i} className="hover:bg-surface-elevated transition-colors"><td className="px-6 py-3 text-content-secondary">{tx.date}</td><td className="px-6 py-3 text-content-primary">{tx.merchant}</td><td className="px-6 py-3 text-right tabular-nums text-content-primary">${formatCurrency(Number(tx.amount))}</td><td className="px-6 py-3 text-content-tertiary">{tx.category ?? '—'}</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!fileData && !importResult && preview.length === 0 && (
        <div className="card text-center py-12"><Upload size={40} className="mx-auto text-content-tertiary mb-3" /><p className="text-content-secondary text-sm">No file selected</p><p className="text-content-tertiary text-xs mt-1">Upload a CSV, OFX, or QFX file to import transactions</p></div>
      )}
    </div>
  );
}
