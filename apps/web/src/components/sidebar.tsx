"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Kanban,
  Clock,
  FileText,
  Receipt,
  MessageSquare,
  LogOut,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Briefcase },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/boards", label: "Projects & Boards", icon: Kanban },
  { href: "/time-tracking", label: "Time Tracking", icon: Clock },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold">SMB Flow</h1>
        <p className="text-xs text-slate-400 mt-1">{user?.orgId ? "Business" : ""}</p>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium">{user?.name || user?.email}</p>
          <p className="text-xs text-slate-400 capitalize">{user?.role?.toLowerCase().replace("_", " ")}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
