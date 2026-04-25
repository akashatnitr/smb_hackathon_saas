"use client";

import { useState } from "react";
import { trpc } from "@/trpc/client";
import { Plus, X, Send } from "lucide-react";

export default function MessagesPage() {
  const utils = trpc.useUtils();
  const { data: conversations, isLoading } = trpc.message.conversations.useQuery();
  const [selectedConv, setSelectedConv] = useState<string | null>(null);
  const { data: conversation } = trpc.message.getConversation.useQuery(
    { id: selectedConv! },
    { enabled: !!selectedConv }
  );
  const sendMutation = trpc.message.sendMessage.useMutation({
    onSuccess: () => {
      utils.message.getConversation.invalidate({ id: selectedConv! });
      utils.message.conversations.invalidate();
      setMessage("");
    },
  });
  const createConvMutation = trpc.message.createConversation.useMutation({
    onSuccess: () => {
      utils.message.conversations.invalidate();
      setShowNewConv(false);
    },
  });

  const [message, setMessage] = useState("");
  const [showNewConv, setShowNewConv] = useState(false);
  const [newConvTitle, setNewConvTitle] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Conversations list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Messages</h2>
          <button
            onClick={() => setShowNewConv(true)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          {conversations?.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 ${
                selectedConv === conv.id ? "bg-indigo-50" : ""
              }`}
            >
              <p className="font-medium text-sm text-gray-900">
                {conv.title || conv.participants.map((p) => p.user.name).join(", ")}
              </p>
              {conv.messages[0] && (
                <p className="text-xs text-gray-500 truncate mt-1">
                  {conv.messages[0].content}
                </p>
              )}
            </button>
          ))}
          {conversations?.length === 0 && (
            <div className="p-4 text-center text-gray-500 text-sm">No conversations yet</div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {selectedConv && conversation ? (
          <>
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                {conversation.title ||
                  conversation.participants.map((p) => p.user.name).join(", ")}
              </h3>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {conversation.messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {msg.sender.name?.charAt(0) || "?"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {msg.sender.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && message.trim()) {
                      sendMutation.mutate({ conversationId: selectedConv, content: message });
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() =>
                    sendMutation.mutate({ conversationId: selectedConv, content: message })
                  }
                  disabled={!message.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a conversation to start messaging
          </div>
        )}
      </div>

      {showNewConv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Conversation</h2>
              <button onClick={() => setShowNewConv(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Title (optional)"
                className="w-full px-3 py-2 border rounded-lg"
                value={newConvTitle}
                onChange={(e) => setNewConvTitle(e.target.value)}
              />
              <button
                onClick={() =>
                  createConvMutation.mutate({
                    title: newConvTitle,
                    participantIds: [],
                  })
                }
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
