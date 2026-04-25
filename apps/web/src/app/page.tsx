import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">SMB Flow</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/signin"
                className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 sm:text-5xl md:text-6xl">
            Manage Your Business
            <span className="text-indigo-600"> All in One Place</span>
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500">
            Clients, employees, projects, time tracking, contracts, invoicing, and messaging — unified.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/auth/signin"
              className="px-8 py-3 text-base font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Get Started
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "Client Management", desc: "Track contacts, companies, and communication history." },
            { title: "Project & Kanban Boards", desc: "Organize work with drag-and-drop boards and task assignments." },
            { title: "Time Tracking", desc: "Log hours, track billable time, and generate reports." },
            { title: "Contracts & E-Sign", desc: "Draft contracts and collect digital signatures." },
            { title: "Invoicing", desc: "Create and send professional invoices to clients." },
            { title: "Team Messaging", desc: "Real-time chat between team members." },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
              <p className="mt-2 text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
