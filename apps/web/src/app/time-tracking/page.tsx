"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Play, Square, Plus, X } from "lucide-react";

export default function TimeTrackingPage() {
  const utils = trpc.useUtils();
  const { data: entries, isLoading } = trpc.timeEntry.list.useQuery();
  const startMutation = trpc.timeEntry.start.useMutation({
    onSuccess: () => utils.timeEntry.list.invalidate(),
  });
  const stopMutation = trpc.timeEntry.stop.useMutation({
    onSuccess: () => utils.timeEntry.list.invalidate(),
  });
  const manualMutation = trpc.timeEntry.createManual.useMutation({
    onSuccess: () => {
      utils.timeEntry.list.invalidate();
      setShowManual(false);
    },
  });

  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    description: "",
    startTime: "",
    endTime: "",
  });

  const runningEntry = entries?.find((e) => !e.endTime);

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
        <h1 className="text-2xl font-bold text-gray-900">Time Tracking</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Plus className="w-4 h-4" />
            Manual Entry
          </button>
          {runningEntry ? (
            <button
              onClick={() => {
                stopMutation.mutate({ id: runningEntry.id });
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <Square className="w-4 h-4" />
              Stop Timer
            </button>
          ) : (
            <button
              onClick={() => startMutation.mutate({ description: "Working" })}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Play className="w-4 h-4" />
              Start Timer
            </button>
          )}
        </div>
      </div>

      {runningEntry && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-indigo-600 font-medium">Timer Running</p>
            <p className="text-gray-800">{runningEntry.description || "Working"}</p>
          </div>
          <div className="text-2xl font-mono font-bold text-indigo-700">
            {Math.floor(
              (Date.now() - new Date(runningEntry.startTime).getTime()) / 1000 / 60
            )}
            m
          </div>
        </div>
      )}

      {showManual && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Manual Time Entry</h2>
              <button onClick={() => setShowManual(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Description"
                className="w-full px-3 py-2 border rounded-lg"
                value={manualForm.description}
                onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
              />
              <input
                type="datetime-local"
                placeholder="Start Time"
                className="w-full px-3 py-2 border rounded-lg"
                value={manualForm.startTime}
                onChange={(e) => setManualForm({ ...manualForm, startTime: e.target.value })}
              />
              <input
                type="datetime-local"
                placeholder="End Time"
                className="w-full px-3 py-2 border rounded-lg"
                value={manualForm.endTime}
                onChange={(e) => setManualForm({ ...manualForm, endTime: e.target.value })}
              />
              <button
                onClick={() =>
                  manualMutation.mutate({
                    description: manualForm.description,
                    startTime: new Date(manualForm.startTime).toISOString(),
                    endTime: new Date(manualForm.endTime).toISOString(),
                  })
                }
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-6 py-3 font-medium">Description</th>
              <th className="px-6 py-3 font-medium">Start</th>
              <th className="px-6 py-3 font-medium">End</th>
              <th className="px-6 py-3 font-medium">Duration</th>
              <th className="px-6 py-3 font-medium">Billable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries?.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">{entry.description || "-"}</td>
                <td className="px-6 py-4 text-gray-600">
                  {new Date(entry.startTime).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {entry.endTime ? new Date(entry.endTime).toLocaleString() : "Running"}
                </td>
                <td className="px-6 py-4">
                  {entry.durationSeconds
                    ? `${(entry.durationSeconds / 3600).toFixed(2)}h`
                    : "-"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      entry.isBillable
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {entry.isBillable ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
            ))}
            {entries?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  No time entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
