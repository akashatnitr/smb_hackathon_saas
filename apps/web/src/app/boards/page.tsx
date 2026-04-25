"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Plus, X, Trash2 } from "lucide-react";
import Link from "next/link";

export default function BoardsPage() {
  const utils = trpc.useUtils();
  const { data: boards, isLoading } = trpc.board.list.useQuery();
  const createMutation = trpc.board.create.useMutation({
    onSuccess: () => {
      utils.board.list.invalidate();
      setShowForm(false);
      setForm({ name: "" });
    },
  });
  const deleteMutation = trpc.board.delete.useMutation({
    onSuccess: () => utils.board.list.invalidate(),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "" });

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
        <h1 className="text-2xl font-bold text-gray-900">Projects & Boards</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          New Board
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Board</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Board name *"
                className="w-full px-3 py-2 border rounded-lg"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <button
                onClick={() => createMutation.mutate({ name: form.name })}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Board
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {boards?.map((board) => (
          <div
            key={board.id}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <Link href={`/boards/${board.id}`} className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 hover:text-indigo-600">
                  {board.name}
                </h3>
                {board.project && (
                  <p className="text-sm text-gray-500">{board.project.name}</p>
                )}
              </Link>
              <button
                onClick={() => deleteMutation.mutate({ id: board.id })}
                className="text-gray-400 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>{board.columns.length} columns</span>
            </div>
            <Link
              href={`/boards/${board.id}`}
              className="mt-4 block w-full text-center py-2 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Open Board
            </Link>
          </div>
        ))}
        {boards?.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No boards yet. Create your first project board above.
          </div>
        )}
      </div>
    </div>
  );
}
