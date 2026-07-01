'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get<Category[]>('/categories'),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => apiClient.post('/categories', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setNewName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      createMutation.mutate(newName.trim());
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Categories</h1>

      {/* Create form */}
      <form onSubmit={handleCreate} className="mb-6 flex gap-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2"
          required
        />
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Adding...' : 'Add Category'}
        </button>
      </form>

      {createMutation.isError && (
        <p className="mb-4 text-sm text-red-600">{createMutation.error.message}</p>
      )}

      {categoriesQuery.isLoading && <p className="text-gray-500">Loading...</p>}
      {categoriesQuery.isError && (
        <p className="text-red-600">{categoriesQuery.error.message}</p>
      )}

      {categoriesQuery.data && (
        <div className="rounded-lg bg-white shadow-sm">
          <ul className="divide-y">
            {categoriesQuery.data.map((cat) => (
              <li key={cat.id} className="flex items-center justify-between px-4 py-3">
                <span className="font-medium">
                  {cat.name}
                  {cat.isDefault && (
                    <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      default
                    </span>
                  )}
                </span>
                {!cat.isDefault && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${cat.name}"? Transactions will be moved to Uncategorized.`)) {
                        deleteMutation.mutate(cat.id);
                      }
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
          {categoriesQuery.data.length === 0 && (
            <p className="p-4 text-gray-500">No categories yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
