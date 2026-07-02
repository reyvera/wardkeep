'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { CategoryIcon } from '@/components/category-icon';
import { Plus, Trash2, Tag, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  parentId: string | null;
  children?: Category[];
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [showForm, setShowForm] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get<Category[]>('/categories'),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => apiClient.post('/categories', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewName('');
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) createMutation.mutate(newName.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-page-title text-content-primary">Categories</h1>
        <button onClick={() => setShowForm(!showForm)} className={showForm ? 'btn-secondary' : 'btn-primary'}>
          {showForm ? <><X size={16} /> Cancel</> : <><Plus size={16} /> Add Category</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          {createMutation.isError && <p className="text-sm text-accent-red">{createMutation.error.message}</p>}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="input-label">Category Name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Groceries, Entertainment" className="input" required />
            </div>
          </div>
          <button type="submit" disabled={createMutation.isPending} className="btn-primary">
            {createMutation.isPending ? 'Adding...' : 'Save Category'}
          </button>
        </form>
      )}

      {categoriesQuery.isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card flex items-center gap-4 py-4">
              <div className="skeleton w-8 h-8 rounded-full" />
              <div className="flex-1"><div className="skeleton h-4 w-32" /></div>
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </div>
      )}

      {categoriesQuery.isError && <div className="card"><p className="text-accent-red text-sm">{categoriesQuery.error.message}</p></div>}

      {categoriesQuery.data && categoriesQuery.data.length > 0 && (
        <div className="space-y-2">
          {categoriesQuery.data.map((cat) => (
            <div key={cat.id} className="card flex items-center gap-4 py-4 hover:border-edge-hover transition-colors duration-150">
              <CategoryIcon name={cat.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary truncate">{cat.name}</p>
                {cat.isDefault && <span className="text-xs text-content-tertiary">System default</span>}
              </div>
              {!cat.isDefault && (
                <button
                  onClick={() => { if (confirm(`Delete "${cat.name}"? Transactions will be moved to Uncategorized.`)) deleteMutation.mutate(cat.id); }}
                  className="btn-ghost p-2 text-content-tertiary hover:text-accent-red"
                  title="Delete category"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {categoriesQuery.data && categoriesQuery.data.length === 0 && (
        <div className="card text-center py-12">
          <Tag size={40} className="mx-auto text-content-tertiary mb-3" />
          <p className="text-content-secondary text-sm">No categories yet</p>
          <p className="text-content-tertiary text-xs mt-1">Add categories to organize your transactions</p>
        </div>
      )}
    </div>
  );
}
