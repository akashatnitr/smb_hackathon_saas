"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Wand2, Send, User, Bot, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: any;
}

interface ChatResponse {
  session_id: string;
  reply: string;
  pending: boolean;
  intent: string | null;
  action: any;
}

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your AI assistant. I can help you:\n• Plan tasks on a kanban board\n• Add new clients\n• Add employees\n• Generate contracts\n\nWhat would you like to do?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: userMsg }],
          session_id: sessionId,
        }),
      });

      const data: ChatResponse = await res.json();
      setSessionId(data.session_id);

      const assistantMsg: Message = {
        role: "assistant",
        content: data.reply,
      };

      if (data.action && !data.pending) {
        assistantMsg.action = data.action;
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't connect to the AI service. Is it running on port 8000?",
        },
      ]);
    }

    setLoading(false);
  };

  const renderActionResult = (action: any) => {
    if (!action) return null;

    if (action.action === "plan_tasks") {
      return (
        <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-indigo-800">
            Created board: {action.board_name}
          </p>
          <p className="text-indigo-600">
            {action.tasks_created} of {action.tasks_planned} tasks created
          </p>
          <ul className="mt-1 space-y-0.5">
            {action.details?.map((d: any, i: number) => (
              <li key={i} className="flex items-center gap-1.5 text-gray-700">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    d.ok ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                {d.task?.title}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (action.action === "add_client") {
      return (
        <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-green-800">
            Client added successfully!
          </p>
        </div>
      );
    }

    if (action.action === "add_employee") {
      return (
        <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-green-800">
            Employee added successfully!
          </p>
          {action.message && (
            <p className="text-green-600 text-xs mt-1">{action.message}</p>
          )}
        </div>
      );
    }

    if (action.action === "generate_contract") {
      return (
        <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
          <p className="font-medium text-purple-800">
            Contract generated successfully!
          </p>
          <p className="text-purple-600 text-xs mt-1">
            You can view it in the Contracts tab.
          </p>
        </div>
      );
    }

    return null;
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
    <div className="fixed bottom-6 right-6 w-[420px] bg-white rounded-xl shadow-xl border z-40 flex flex-col max-h-[700px]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-indigo-600 text-white rounded-t-xl">
        <div className="flex items-center gap-2">
          <Wand2 className="w-5 h-5" />
          <h3 className="font-semibold">AI Assistant</h3>
          {sessionId && (
            <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="text-indigo-200 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-4 space-y-4 min-h-[300px] max-h-[500px]"
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === "user"
                  ? "bg-gray-200 text-gray-600"
                  : "bg-indigo-100 text-indigo-600"
              }`}
            >
              {msg.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div
              className={`max-w-[80%] rounded-lg p-3 text-sm ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="whitespace-pre-line">{msg.content}</p>
              {msg.action && renderActionResult(msg.action)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-gray-100 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Try: "Plan an event", "Add client John", "Generate a contract for
          design services"
        </p>
      </div>
    </div>
  );
}
