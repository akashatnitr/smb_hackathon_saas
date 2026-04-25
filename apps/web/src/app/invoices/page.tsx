"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Plus, X, Trash2, Receipt } from "lucide-react";

export default function InvoicesPage() {
  const utils = trpc.useUtils();
  const { data: invoices, isLoading } = trpc.invoice.list.useQuery();
  const createMutation = trpc.invoice.create.useMutation({
    onSuccess: () => {
      utils.invoice.list.invalidate();
      setShowForm(false);
    },
  });
  const deleteMutation = trpc.invoice.delete.useMutation({
    onSuccess: () => utils.invoice.list.invalidate(),
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    number: "",
    issueDate: "",
    dueDate: "",
    total: 0,
    lineItems: [{ description: "", quantity: 1, rate: 0, amount: 0 }],
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Invoice</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Invoice number *"
                className="w-full px-3 py-2 border rounded-lg"
                value={form.number}
                onChange={(e) => setForm({ ...form, number: e.target.value })}
              />
              <input
                type="date"
                placeholder="Issue date"
                className="w-full px-3 py-2 border rounded-lg"
                value={form.issueDate}
                onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              />
              <input
                type="date"
                placeholder="Due date"
                className="w-full px-3 py-2 border rounded-lg"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
              {form.lineItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2">
                  <input
                    placeholder="Description"
                    className="col-span-2 px-3 py-2 border rounded-lg"
                    value={item.description}
                    onChange={(e) => {
                      const items = [...form.lineItems];
                      items[idx].description = e.target.value;
                      setForm({ ...form, lineItems: items });
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    className="px-3 py-2 border rounded-lg"
                    value={item.quantity}
                    onChange={(e) => {
                      const items = [...form.lineItems];
                      items[idx].quantity = Number(e.target.value);
                      items[idx].amount = items[idx].quantity * items[idx].rate;
                      setForm({ ...form, lineItems: items });
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Rate"
                    className="px-3 py-2 border rounded-lg"
                    value={item.rate}
                    onChange={(e) => {
                      const items = [...form.lineItems];
                      items[idx].rate = Number(e.target.value);
                      items[idx].amount = items[idx].quantity * items[idx].rate;
                      setForm({ ...form, lineItems: items });
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() =>
                  setForm({
                    ...form,
                    lineItems: [...form.lineItems, { description: "", quantity: 1, rate: 0, amount: 0 }],
                  })
                }
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                + Add Line Item
              </button>
              <button
                onClick={() =>
                  createMutation.mutate({
                    ...form,
                    total: form.lineItems.reduce((sum, item) => sum + item.amount, 0),
                    issueDate: new Date(form.issueDate).toISOString(),
                    dueDate: new Date(form.dueDate).toISOString(),
                  })
                }
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 font-medium">Number</th>
              <th className="px-6 py-3 font-medium">Issue Date</th>
              <th className="px-6 py-3 font-medium">Due Date</th>
              <th className="px-6 py-3 font-medium">Total</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices?.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{invoice.number}</td>
                <td className="px-6 py-4 text-gray-600">
                  {new Date(invoice.issueDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {new Date(invoice.dueDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 font-medium">${Number(invoice.total).toFixed(2)}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      invoice.status === "PAID"
                        ? "bg-green-100 text-green-700"
                        : invoice.status === "OVERDUE"
                        ? "bg-red-100 text-red-700"
                        : invoice.status === "SENT"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => deleteMutation.mutate({ id: invoice.id })}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {invoices?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No invoices yet. Create your first invoice above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
