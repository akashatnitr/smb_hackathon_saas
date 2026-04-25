"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Plus, X, Trash2, FileText, Eye } from "lucide-react";
import Link from "next/link";

export default function ContractsPage() {
  const utils = trpc.useUtils();
  const { data: contracts, isLoading } = trpc.contract.list.useQuery();
  const createMutation = trpc.contract.create.useMutation({
    onSuccess: () => {
      utils.contract.list.invalidate();
      setShowForm(false);
    },
  });
  const deleteMutation = trpc.contract.delete.useMutation({
    onSuccess: () => utils.contract.list.invalidate(),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", content: "" });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          New Contract
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Contract</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Contract title *"
                className="w-full px-3 py-2 border rounded-lg"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                placeholder="Contract content (HTML supported)"
                className="w-full px-3 py-2 border rounded-lg font-mono text-sm"
                rows={12}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
              <button
                onClick={() => createMutation.mutate(form)}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Contract
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {contracts?.map((contract) => (
          <div
            key={contract.id}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-4">
              <Link
                href={`/contracts/${contract.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">
                    {contract.title}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Date(contract.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
              <div className="flex items-center gap-1 ml-2">
                <Link
                  href={`/contracts/${contract.id}`}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => deleteMutation.mutate({ id: contract.id })}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <Link href={`/contracts/${contract.id}`} className="block">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    contract.status === "SIGNED"
                      ? "bg-green-100 text-green-700"
                      : contract.status === "SENT"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {contract.status}
                </span>
                {contract.client && (
                  <span className="text-xs text-gray-500">{contract.client.name}</span>
                )}
              </div>
            </Link>
          </div>
        ))}
        {contracts?.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No contracts yet. Create your first contract above.
          </div>
        )}
      </div>
    </div>
  );
}
