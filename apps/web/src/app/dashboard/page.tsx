"use client";

import { trpc } from "@/trpc/client";
import {
  Users,
  Briefcase,
  Kanban,
  Clock,
  Receipt,
  AlertCircle,
} from "lucide-react";

export default function DashboardPage() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const cards = [
    { label: "Clients", value: stats?.totalClients ?? 0, icon: Briefcase, color: "bg-blue-500" },
    { label: "Employees", value: stats?.totalEmployees ?? 0, icon: Users, color: "bg-green-500" },
    { label: "Total Tasks", value: stats?.totalTasks ?? 0, icon: Kanban, color: "bg-purple-500" },
    { label: "Pending Tasks", value: stats?.pendingTasks ?? 0, icon: AlertCircle, color: "bg-orange-500" },
    { label: "Hours This Week", value: `${(stats?.totalTimeThisWeek ?? 0).toFixed(1)}h`, icon: Clock, color: "bg-teal-500" },
    { label: "Pending Invoices", value: stats?.pendingInvoices ?? 0, icon: Receipt, color: "bg-red-500" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl shadow-sm p-6 flex items-center gap-4"
            >
              <div className={`${card.color} p-3 rounded-lg text-white`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
