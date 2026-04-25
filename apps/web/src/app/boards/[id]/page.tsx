"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/trpc/client";
import { Plus, X, Trash2, GripVertical } from "lucide-react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// --- Types ---
interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  labels: string[];
  dueDate: string | Date | null;
  assigneeId: string | null;
  creatorId: string;
  columnId: string;
  boardId: string;
  orgId: string;
  projectId: string | null;
  assignee: { id: string; name: string | null; image: string | null } | null;
  column: { id: string; name: string };
}

interface Column {
  id: string;
  name: string;
  order: number;
}

// --- Draggable Task Card ---
function SortableTaskCard({
  task,
  onClick,
  onDelete,
}: {
  task: Task;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "Task", task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className="bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-medium text-sm text-gray-900">{task.title}</h4>
            <button
              onClick={onDelete}
              className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
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
      </div>
    </div>
  );
}

// --- Droppable Column ---
function BoardColumn({
  column,
  tasks,
  onAddTask,
  onTaskClick,
  onTaskDelete,
}: {
  column: Column;
  tasks: Task[];
  onAddTask: (columnId: string) => void;
  onTaskClick: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
}) {
  const { setNodeRef } = useSortable({
    id: column.id,
    data: { type: "Column", column },
  });

  return (
    <div
      ref={setNodeRef}
      className="min-w-[280px] bg-gray-100 rounded-xl p-4 flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-700">{column.name}</h3>
        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-3 flex-1 min-h-[100px]">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task)}
              onDelete={(e) => {
                e.stopPropagation();
                onTaskDelete(task.id);
              }}
            />
          ))}
        </SortableContext>
      </div>
      <button
        onClick={() => onAddTask(column.id)}
        className="mt-3 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:text-indigo-600 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Task
      </button>
    </div>
  );
}

// --- Main Page ---
export default function BoardDetailPage() {
  const params = useParams();
  const boardId = params.id as string;
  const utils = trpc.useUtils();

  const { data: board, isLoading } = trpc.board.get.useQuery({ id: boardId });
  const { data: serverTasks } = trpc.task.list.useQuery({ boardId });

  const moveTask = trpc.task.move.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.board.get.invalidate({ id: boardId });
    },
  });
  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.board.get.invalidate({ id: boardId });
      setShowTaskForm(false);
    },
  });
  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.board.get.invalidate({ id: boardId });
    },
  });

  // Local task state for optimistic drag-and-drop
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Sync server tasks into local state
  const syncedTasks = useMemo(() => {
    if (serverTasks) return serverTasks;
    return tasks;
  }, [serverTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    assigneeId: "",
  });
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!board) return <div>Board not found</div>;

  const columns = board.columns as Column[];

  const tasksByColumn = (columnId: string) =>
    syncedTasks?.filter((t) => t.columnId === columnId) || [];

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = syncedTasks?.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = syncedTasks?.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Find which column we're over
    const overColumn = columns.find((c) => c.id === overId);
    const overTask = syncedTasks?.find((t) => t.id === overId);
    const targetColumnId = overColumn?.id || overTask?.columnId;

    if (!targetColumnId || activeTask.columnId === targetColumnId) return;

    // Optimistically update local state
    setTasks((prev) => {
      const base = serverTasks || prev;
      return base.map((t) =>
        t.id === activeId ? { ...t, columnId: targetColumnId } : t
      );
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = syncedTasks?.find((t) => t.id === activeId);
    if (!activeTask) return;

    const overColumn = columns.find((c) => c.id === overId);
    const overTask = syncedTasks?.find((t) => t.id === overId);
    const targetColumnId = overColumn?.id || overTask?.columnId;

    if (!targetColumnId) return;

    // If actually moved to a different column, call API
    if (activeTask.columnId !== targetColumnId) {
      moveTask.mutate({ id: activeId, columnId: targetColumnId });
    }
  }

  const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{board.name}</h1>
          {board.project && (
            <p className="text-sm text-gray-500">{board.project.name}</p>
          )}
        </div>
        <Link
          href="/boards"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to boards
        </Link>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={tasksByColumn(column.id)}
              onAddTask={(columnId) => {
                setSelectedColumn(columnId);
                setShowTaskForm(true);
              }}
              onTaskClick={setSelectedTask}
              onTaskDelete={(taskId) => deleteTask.mutate({ id: taskId })}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeTask ? (
            <div className="bg-white p-3 rounded-lg shadow-lg opacity-90 rotate-2">
              <h4 className="font-medium text-sm text-gray-900">
                {activeTask.title}
              </h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* New Task Modal */}
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
                onChange={(e) =>
                  setTaskForm({ ...taskForm, title: e.target.value })
                }
              />
              <textarea
                placeholder="Description"
                className="w-full px-3 py-2 border rounded-lg"
                rows={3}
                value={taskForm.description}
                onChange={(e) =>
                  setTaskForm({ ...taskForm, description: e.target.value })
                }
              />
              <select
                className="w-full px-3 py-2 border rounded-lg"
                value={taskForm.priority}
                onChange={(e) =>
                  setTaskForm({
                    ...taskForm,
                    priority: e.target.value as any,
                  })
                }
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

      {/* Task Detail Modal */}
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
                <label className="text-sm font-medium text-gray-600">
                  Description
                </label>
                <p className="text-gray-800 mt-1">
                  {selectedTask.description || "No description"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Priority
                  </label>
                  <p className="text-gray-800 mt-1">{selectedTask.priority}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Assignee
                  </label>
                  <p className="text-gray-800 mt-1">
                    {selectedTask.assignee?.name || "Unassigned"}
                  </p>
                </div>
              </div>
              {selectedTask.dueDate && (
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Due Date
                  </label>
                  <p className="text-gray-800 mt-1">
                    {new Date(selectedTask.dueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Move to Column
                </label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {columns.map((col) => (
                    <button
                      key={col.id}
                      onClick={() => {
                        moveTask.mutate({
                          id: selectedTask.id,
                          columnId: col.id,
                        });
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
