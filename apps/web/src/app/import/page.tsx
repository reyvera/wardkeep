'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface PreviewTransaction {
  date: string;
  merchant: string;
  amount: number;
  category?: string;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: number;
}

export default function ImportPage() {
  const [format, setFormat] = useState<'csv' | 'ofx' | 'qfx'>('csv');
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [columnMapping, setColumnMapping] = useState({
    date: 'date',
    merchant: 'description',
    amount: 'amount',
    category: 'category',
  });
  const [preview, setPreview] = useState<PreviewTransaction[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ transactions: PreviewTransaction[] }>('/import/preview', {
        fileData,
        format,
        columnMapping: format === 'csv' ? columnMapping : undefined,
      }),
    onSuccess: (data) => setPreview(data.transactions.slice(0, 10)),
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      apiClient.post<ImportResult>('/import/commit', {
        fileData,
        format,
        columnMapping: format === 'csv' ? columnMapping : undefined,
      }),
    onSuccess: (data) => {
      setImportResult(data);
      setPreview([]);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResult(null);
    setPreview([]);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] ?? result;
      setFileData(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Import Transactions</h1>

      <div className="rounded-lg bg-white p-6 shadow-sm space-y-4 mb-6">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'csv' | 'ofx' | 'qfx')}
              className="rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="csv">CSV</option>
              <option value="ofx">OFX</option>
              <option value="qfx">QFX</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
            <input
              type="file"
              accept=".csv,.ofx,.qfx"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
        {fileName && <p className="text-sm text-gray-600">Selected: {fileName}</p>}

        {/* Column mapping for CSV */}
        {format === 'csv' && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Column Mapping</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500">Date column</label>
                <input
                  value={columnMapping.date}
                  onChange={(e) => setColumnMapping({ ...columnMapping, date: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Merchant column</label>
                <input
                  value={columnMapping.merchant}
                  onChange={(e) => setColumnMapping({ ...columnMapping, merchant: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Amount column</label>
                <input
                  value={columnMapping.amount}
                  onChange={(e) => setColumnMapping({ ...columnMapping, amount: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Category column</label>
                <input
                  value={columnMapping.category}
                  onChange={(e) => setColumnMapping({ ...columnMapping, category: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => previewMutation.mutate()}
            disabled={!fileData || previewMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {previewMutation.isPending ? 'Loading...' : 'Preview'}
          </button>
          {preview.length > 0 && (
            <button
              onClick={() => commitMutation.mutate()}
              disabled={commitMutation.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {commitMutation.isPending ? 'Importing...' : 'Commit Import'}
            </button>
          )}
        </div>

        {previewMutation.isError && (
          <p className="text-sm text-red-600">{previewMutation.error.message}</p>
        )}
      </div>

      {/* Import result */}
      {importResult && (
        <div className="mb-6 rounded-lg bg-green-50 border border-green-200 p-4">
          <h3 className="font-medium text-green-800 mb-1">Import Complete</h3>
          <p className="text-sm text-green-700">
            Imported: {importResult.imported} · Duplicates skipped: {importResult.duplicates} · Errors: {importResult.errors}
          </p>
        </div>
      )}

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
          <h3 className="px-4 pt-4 font-medium">Preview (first 10 rows)</h3>
          <table className="w-full text-left text-sm mt-2">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Merchant</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {preview.map((tx, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">{tx.date}</td>
                  <td className="px-4 py-3">{tx.merchant}</td>
                  <td className="px-4 py-3 text-right font-mono">${Number(tx.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">{tx.category ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
