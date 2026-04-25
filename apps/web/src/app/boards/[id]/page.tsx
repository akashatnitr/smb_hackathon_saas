"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/trpc/client";
import { Plus, X, Trash2, MessageSquare } from "lucide-react";

export default function BoardDetailPage() {
  const params = useParams();
  const boardId = params.id as string;
  const utils = trpc.useUtils();
  const { data: board, isLoading } = trpc.board.get.useQuery({ id: boardId });
  const { data: tasks } = trpc.task.list.useQuery({ boardId });
  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.board.get.invalidate({ id: boardId });
      setShowTaskForm(false);
    },
  });
  const moveTask = trpc.task.move.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.board.get.invalidate({ id: boardId });
    },
  });
  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.board.get.invalidate({ id: boardId });
    },
  });

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    assigneeId: "",
  });
  const [selectedTask, setSelectedTask] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!board) return <div>Board not found</div>;

  const tasksByColumn = (columnId: string) =>
    tasks?.filter((t) => t.columnId === columnId) || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{board.name}</h1>
          {board.project && (
            <p className="text-sm text-gray-500">{board.project.name}</p>
          )}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.columns.map((column) => (
          <div
            key={column.id}
            className="min-w-[280px] bg-gray-100 rounded-xl p-4 flex flex-col"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">{column.name}</h3>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                {tasksByColumn(column.id).length}
              </span>
            </div>
            <div className="space-y-3 flex-1">
              {tasksByColumn(column.id).map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-sm text-gray-900">{task.title}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteTask.mutate({ id: task.id });
                      }}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {task.assignee && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-medium">
                        {task.assignee.name?.charAt(0) || "?"}
                      </div>
                      <span className="text-xs text-gray-500">{task.assignee.name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        task.priority === "URGENT"
                          ? "bg-red-100 text-red-700"
                          : task.priority === "HIGH"
                          ? "bg-orange-100 text-orange-700"
                          : task.priority === "MEDIUM"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                setSelectedColumn(column.id);
                setShowTaskForm(true);
              }}
              className="mt-3 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Task
            </button>
          </div>
        ))}
      </div>

      {showTaskForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New Task</h2>
              <button onClick={() => setShowTaskForm(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <input
                placeholder="Task title *"
                className="w-full px-3 py-2 border rounded-lg"
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              />
              <textarea
                placeholder="Description"
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              />
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
              <button
                onClick={() =>
                  createTask.mutate({
                    ...taskForm,
                    columnId: selectedColumn,
                    boardId,
                  })
                }
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{selectedTask.title}</h2>
              <button onClick={() => setSelectedTask(null)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="text-gray-800 mt-1">{selectedTask.description || "No description"}</p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Priority</label>
                  <p className="text-gray-800 mt-1">{selectedTask.priority}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Assignee</label>
                  <p className="text-gray-800 mt-1">{selectedTask.assignee?.name || "Unassigned"}</p>
                </div>
              </div>
              {selectedTask.dueDate && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Due Date</label>
                  <p className="text-gray-800 mt-1">
                    {new Date(selectedTask.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-600">Move to Column</label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {board.columns.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => {
                        moveTask.mutate({ id: selectedTask.id, columnId: col.id });
                        setSelectedTask(null);
                      }}
                      className="px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-indigo-100 hover:text-indigo-700"
                    >
                      {col.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
