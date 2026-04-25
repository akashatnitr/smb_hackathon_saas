"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Plus, Trash2, X } from "lucide-react";

export default function EmployeesPage() {
  const utils = trpc.useUtils();
  const { data: employees, isLoading } = trpc.user.list.useQuery();
  const { data: workload } = trpc.user.workload.useQuery();
  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      utils.user.workload.invalidate();
      setShowForm(false);
      setForm({ name: "", email: "", password: "", role: "ORG_EMPLOYEE" });
    },
  });
  const deleteMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
      utils.user.workload.invalidate();
    },
  });

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "ORG_EMPLOYEE" as "ORG_ADMIN" | "ORG_EMPLOYEE",
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
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Employee</h2>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Name *"
                className="w-full px-3 py-2 border rounded-lg"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                placeholder="Email *"
                className="w-full px-3 py-2 border rounded-lg"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <input
                placeholder="Password * (min 6 chars)"
                type="password"
                className="w-full px-3 py-2 border rounded-lg"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as any })}
              >
                <option value="ORG_EMPLOYEE">Employee</option>
                <option value="ORG_ADMIN">Admin</option>
              </select>
              <button
                onClick={() => createMutation.mutate(form)}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Employee
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Team Members</h2>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Tasks</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees?.map((emp: any) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{emp.name || emp.email}</div>
                    <div className="text-xs text-gray-500">{emp.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      emp.role === "ORG_ADMIN" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {emp.role === "ORG_ADMIN" ? "Admin" : "Employee"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{emp._count.assignedTasks}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() =>
                        deleteMutation.mutate({ id: emp.id, isActive: !emp.isActive })
                      }
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Workload</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {workload?.map((emp: any) => (
              <div key={emp.id} className="px-6 py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{emp.name || emp.email}</span>
                  <span className="text-sm text-gray-500">
                    {emp.totalHoursThisWeek.toFixed(1)}h this week
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (emp.assignedTasks.length / 10) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-12 text-right">
                    {emp.assignedTasks.length} tasks
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
