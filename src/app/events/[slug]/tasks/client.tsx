"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssignedToSelect } from "@/components/assigned-to-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Calendar, User, X, Pencil, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/confirm-dialog";
import { toast } from "sonner";
import { validateRequired, getApiError } from "@/lib/validation";

type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
type Priority = "low" | "medium" | "high" | "urgent";

const statusConfig: Record<TaskStatus, { label: string; color: string; bg: string }> = {
  todo: { label: "To Do", color: "bg-stone-100 text-stone-600", bg: "bg-stone-50" },
  in_progress: { label: "In Progress", color: "bg-sky-50 text-sky-700", bg: "bg-sky-50/30" },
  done: { label: "Done", color: "bg-emerald-50 text-emerald-700", bg: "bg-emerald-50/30" },
  blocked: { label: "Blocked", color: "bg-red-50 text-red-600", bg: "bg-red-50/30" },
};

const priorityConfig: Record<Priority, { label: string; color: string; dot: string }> = {
  urgent: { label: "Urgent", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
  high: { label: "High", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-500" },
  medium: { label: "Medium", color: "bg-stone-100 text-stone-600", dot: "bg-stone-400" },
  low: { label: "Low", color: "bg-stone-50 text-stone-400", dot: "bg-stone-300" },
};

const STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked", "done"];

type Team = { id: string; name: string; color: string | null; sortOrder: number };
type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  teamId: string | null;
  assigneeName: string | null;
  assignedTo: string | null;
  dueDate: Date | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
};

export function TasksClient({ initialTasks, initialTeams }: { initialTasks: Task[]; initialTeams: Team[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [teamFilter, setTeamFilter] = useState<string | "all">("all");
  const [view, setView] = useState<"board">("board");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [teams, setTeams] = useState(initialTeams);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const refreshTasks = async () => {
    const res = await fetch("/api/tasks");
    const d = await res.json();
    if (d.data) setTasks(d.data);
  };

  const filtered = tasks
    .filter((t) => teamFilter === "all" || t.teamId === teamFilter);

  // ─── Drag and Drop ─────────────────────────────────

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDragging(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain");
    setDragging(null);

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    const previousStatus = task.status;

    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: newStatus } : t));

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify({ status: newStatus }),
    });

    if (!res.ok) {
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: previousStatus } : t));
      toast.error(await getApiError(res, "Failed to move task"));
      return;
    }

    refreshTasks();
  };

  const handleDragEnd = () => setDragging(null);

  // ─── Create Task ───────────────────────────────────

  const handleCreate = async (data: Record<string, string>) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to create task"));
      return;
    }
    setShowCreate(false);
    refreshTasks();
  };

  // ─── Update Task ───────────────────────────────────

  const handleUpdateTask = async (taskId: string, updates: Record<string, unknown>) => {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "If-Match": "999" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      toast.error(await getApiError(res, "Failed to save changes"));
    }
    refreshTasks();
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} tasks across {teams.length} teams</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-3 w-3" /> Add Task
        </Button>
      </div>

      {/* Team filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setTeamFilter("all")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            teamFilter === "all" ? "bg-yellow-500 text-stone-900" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          All Teams ({tasks.length})
        </button>
        {teams.map((team) => (
          <TeamPill
            key={team.id}
            team={team}
            count={tasks.filter((t) => t.teamId === team.id).length}
            active={teamFilter === team.id}
            onClick={() => setTeamFilter(team.id)}
            onRename={async (name) => {
              await fetch(`/api/teams/${team.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
              });
              setTeams((prev) => prev.map((t) => t.id === team.id ? { ...t, name } : t));
            }}
            onDelete={async () => {
              await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
              setTeams((prev) => prev.filter((t) => t.id !== team.id));
              if (teamFilter === team.id) setTeamFilter("all");
            }}
          />
        ))}
        {showNewTeam ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              className="h-8 w-32 text-xs"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newTeamName.trim()) {
                  const res = await fetch("/api/teams", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newTeamName.trim() }),
                  });
                  if (res.ok) {
                    const d = await res.json();
                    setTeams((prev) => [...prev, d.data]);
                  }
                  setNewTeamName("");
                  setShowNewTeam(false);
                }
                if (e.key === "Escape") { setShowNewTeam(false); setNewTeamName(""); }
              }}
            />
            <button onClick={() => { setShowNewTeam(false); setNewTeamName(""); }} className="text-stone-400 hover:text-stone-600">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewTeam(true)}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-yellow-700 border border-dashed border-yellow-300 hover:bg-yellow-50 transition-colors"
          >
            + New Team
          </button>
        )}
      </div>

      {/* Board view (Kanban) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUSES.map((status) => {
          const columnTasks = filtered.filter((t) => t.status === status);
          return (
            <div
              key={status}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
              className={`rounded-lg p-2 min-h-[200px] transition-colors ${
                dragging ? "ring-2 ring-dashed ring-yellow-400/50" : ""
              } ${statusConfig[status].bg}`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{statusConfig[status].label}</h3>
                  <span className="text-xs text-muted-foreground tabular-nums">{columnTasks.length}</span>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {columnTasks.map((task) => {
                  const team = teams.find((t) => t.id === task.teamId);
                  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
                  const pCfg = priorityConfig[task.priority as Priority] || priorityConfig.medium;

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedTask(task)}
                      className={`rounded-md border bg-white p-3 cursor-pointer hover:border-yellow-500/40 transition-all ${
                        dragging === task.id ? "opacity-40 scale-95" : ""
                      }`}
                    >
                      {/* Priority dot + title */}
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pCfg.dot}`} />
                        <p className="text-sm font-medium line-clamp-2 leading-snug min-h-[2.5rem]">{task.title}</p>
                      </div>

                      {/* Meta row */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {team && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: team.color ?? "#999" }} />
                            {team.name}
                          </span>
                        )}
                        {(task.assigneeName || task.assignedTo) && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <User className="h-2.5 w-2.5" />
                            {task.assigneeName || task.assignedTo}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                            <Calendar className="h-2.5 w-2.5" />
                            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {columnTasks.length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-center">
                    <p className="text-xs text-muted-foreground">Drop tasks here</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Dialog */}
      {showCreate && (
        <CreateTaskDialog
          teams={teams}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}

      {/* Task Detail Drawer */}
      {selectedTask && (
        <TaskDetailDrawer
          task={selectedTask}
          teams={teams}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updates) => handleUpdateTask(selectedTask.id, updates)}
        />
      )}
    </div>
  );
}

// ─── Team Pill (with rename/delete) ──────────────────

function TeamPill({
  team,
  count,
  active,
  onClick,
  onRename,
  onDelete,
}: {
  team: Team;
  count: number;
  active: boolean;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const { confirm: confirmDialog } = useConfirm();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(team.name);

  if (renaming) {
    return (
      <div className="flex items-center gap-1">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-32 text-xs"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              onRename(name.trim());
              setRenaming(false);
            }
            if (e.key === "Escape") { setRenaming(false); setName(team.name); }
          }}
          onBlur={() => { setRenaming(false); setName(team.name); }}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onContextMenu={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 group ${
          active ? "bg-yellow-500 text-stone-900" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
        }`}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color ?? "#999" }} />
        {team.name} ({count})
        <span
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-stone-400 hover:text-stone-600"
        >
          ...
        </span>
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 rounded-md border bg-white py-1 shadow-lg min-w-[120px] dropdown-active">
            <button
              onClick={() => { setMenuOpen(false); setRenaming(true); }}
              className="block w-full px-3 py-1.5 text-left text-xs hover:bg-stone-50"
            >
              Rename
            </button>
            <button
              onClick={async () => {
                setMenuOpen(false);
                const confirmed = await confirmDialog({
                  title: `Delete "${team.name}"`,
                  message: "Tasks assigned to this team will keep their data but lose their team association.",
                  confirmLabel: "Delete Team",
                  variant: "danger",
                });
                if (confirmed) onDelete();
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Create Task Dialog ──────────────────────────────

function CreateTaskDialog({
  teams,
  onClose,
  onCreate,
}: {
  teams: Team[];
  onClose: () => void;
  onCreate: (data: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    teamId: "",
    assigneeName: "",
    dueDate: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-active" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg dialog-active">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">New Task</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              autoFocus
              value={form.title}
              onChange={(e) => { setForm({ ...form, title: e.target.value }); setErrors((prev) => { const { title: _, ...rest } = prev; return rest; }); }}
              placeholder="What needs to be done?"
              aria-invalid={!!errors.title}
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add details, context, or links..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Team</Label>
              <select
                value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">No team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <AssignedToSelect
                value={form.assigneeName}
                onChange={(val) => setForm({ ...form, assigneeName: val })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => {
                const newErrors = validateRequired(form, ["title"]);
                if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
                setErrors({});
                onCreate(form);
              }}
            >
              Create Task
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Task Detail Drawer ──────────────────────────────

function TaskDetailDrawer({
  task,
  teams,
  onClose,
  onUpdate,
}: {
  task: Task;
  teams: Team[];
  onClose: () => void;
  onUpdate: (updates: Record<string, unknown>) => void;
}) {
  const [notes, setNotes] = useState<{ id: string; content: string; authorName: string; authorEmail: string | null; createdAt: string }[]>([]);
  const [newNote, setNewNote] = useState("");
  const [postingNote, setPostingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const { confirm: confirmDialog } = useConfirm();

  useEffect(() => {
    fetch(`/api/notes?entityType=task&entityId=${task.id}`)
      .then((r) => r.json())
      .then((d) => { if (d.data) setNotes(d.data); })
      .catch(() => {});
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => { if (d.data?.email) setCurrentUserEmail(d.data.email); })
      .catch(() => {});
  }, [task.id]);

  const handlePostNote = async () => {
    if (!newNote.trim()) return;
    setPostingNote(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType: "task", entityId: task.id, content: newNote.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setNotes((prev) => [...prev, d.data]);
      setNewNote("");
    }
    setPostingNote(false);
  };

  const handleEditNote = async (noteId: string) => {
    if (!editContent.trim()) return;
    const res = await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      setNotes((prev) => prev.map((n) => n.id === noteId ? { ...n, content: d.data.content } : n));
    }
    setEditingNoteId(null);
    setEditContent("");
  };

  const handleDeleteNote = async (noteId: string) => {
    const confirmed = await confirmDialog({
      title: "Delete comment",
      message: "Are you sure you want to delete this comment? This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  };

  const [form, setForm] = useState({
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    teamId: task.teamId || "",
    assigneeName: task.assigneeName || task.assignedTo || "",
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
  });

  const team = teams.find((t) => t.id === task.teamId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = () => {
    onUpdate({
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      teamId: form.teamId || null,
      assigneeName: form.assigneeName || null,
      assignedTo: form.assigneeName || null,
      dueDate: form.dueDate || null,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-active" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l shadow-xl flex flex-col slide-right-active">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge className={statusConfig[form.status as TaskStatus]?.color}>
              {statusConfig[form.status as TaskStatus]?.label}
            </Badge>
            {team && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color ?? "#999" }} />
                {team.name}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1.5 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="text-lg font-medium border-0 px-0 focus-visible:ring-0 shadow-none"
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add details, context, or links..."
              rows={5}
              className="resize-none"
            />
          </div>

          {/* Properties */}
          <div className="space-y-3 pt-2 border-t">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{statusConfig[s].label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Team</Label>
                <select
                  value={form.teamId}
                  onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assignee</Label>
                <AssignedToSelect
                  value={form.assigneeName}
                  onChange={(val) => setForm({ ...form, assigneeName: val })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
          </div>

          {/* Notes / Comments */}
          <div className="space-y-3 pt-4 border-t">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Comments ({notes.length})
            </Label>

            {notes.length > 0 && (
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {notes.map((note) => {
                  const isOwn = currentUserEmail && note.authorEmail === currentUserEmail;

                  if (editingNoteId === note.id) {
                    return (
                      <div key={note.id} className="rounded-md bg-yellow-50 px-3 py-2 space-y-2">
                        <Input
                          autoFocus
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="text-xs"
                          onKeyDown={(e) => { if (e.key === "Enter") handleEditNote(note.id); if (e.key === "Escape") setEditingNoteId(null); }}
                        />
                        <div className="flex gap-1">
                          <Button size="sm" className="h-6 text-[10px]" onClick={() => handleEditNote(note.id)}>Save</Button>
                          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={note.id} className="rounded-md bg-stone-50 hover:bg-stone-100 px-3 py-3 group transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{note.authorName}</span>
                        <div className="flex items-center gap-2">
                          {isOwn && (
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                              <button
                                onClick={() => { setEditingNoteId(note.id); setEditContent(note.content); }}
                                className="rounded p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-200 transition-colors"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                className="rounded p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-stone-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a comment..."
                className="text-xs"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePostNote(); } }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!newNote.trim() || postingNote}
                onClick={handlePostNote}
              >
                {postingNote ? "..." : "Post"}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-3">
          <Button className="w-full" onClick={handleSave}>Save Changes</Button>
        </div>
      </aside>
    </>
  );
}
