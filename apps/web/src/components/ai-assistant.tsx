"use client";

import { useState } from "react";
import { Sparkles, X, Wand2 } from "lucide-react";

interface AIAssistantProps {
  boardId?: string;
}

export function AIAssistant({ boardId }: AIAssistantProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handlePlan = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("http://localhost:8000/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, board_id: boardId }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: "Failed to connect to AI service. Is it running?" });
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors z-40"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white rounded-xl shadow-xl border z-40 flex flex-col max-h-[600px]">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">AI Assistant</h3>
        </div>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="p-4 space-y-4 overflow-auto flex-1">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            What would you like to plan?
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Plan me a product launch event"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            rows={3}
          />
        </div>
        <button
          onClick={handlePlan}
          disabled={loading || !prompt.trim()}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? "Planning..." : "Generate Plan & Create Tasks"}
        </button>

        {result && (
          <div className="space-y-2">
            {result.error ? (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                {result.error}
              </div>
            ) : (
              <div className="p-3 bg-green-50 text-green-800 rounded-lg text-sm">
                <p className="font-medium">
                  Created {result.tasks_created} tasks on board!
                </p>
                <ul className="mt-2 space-y-1">
                  {result.details?.map((d: any, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                      {d.task?.title}
                      {d.error && <span className="text-red-600">({d.error})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
