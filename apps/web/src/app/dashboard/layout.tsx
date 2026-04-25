import { Sidebar } from "@/components/sidebar";
import { AIAssistant } from "@/components/ai-assistant";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
      <AIAssistant />
    </div>
  );
}
