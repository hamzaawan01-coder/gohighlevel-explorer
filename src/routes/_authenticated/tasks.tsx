import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Trash2, CheckCircle2, Circle, Clock, AlertCircle, XCircle, CheckSquare } from "lucide-react";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/states";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  TASK_STATUSES,
  TASK_PRIORITIES,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks";
import { fetchContacts, type Contact } from "@/lib/contacts";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Agency Engine" },
      { name: "description", content: "Follow-ups, calls, and to-dos scoped to this workspace." },
    ],
  }),
  component: TasksPage,
});

const STATUS_FILTERS: { value: TaskStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_CLASS: Record<TaskPriority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-accent/10 text-accent",
  high: "bg-amber-500/10 text-amber-600",
  urgent: "bg-destructive/10 text-destructive",
};

function TasksPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("open");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const tasksQ = useQuery({
    queryKey: ["tasks", subId],
    queryFn: () => fetchTasks(subId!),
    enabled: !!subId,
  });

  const contactsQ = useQuery({
    queryKey: ["contacts", subId],
    queryFn: () => fetchContacts(subId!),
    enabled: !!subId,
  });

  const tasks = tasksQ.data ?? [];
  const contacts = contactsQ.data ?? [];
  const contactMap = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);

  const filtered = useMemo(
    () => (statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter)),
    [tasks, statusFilter],
  );

  const createMut = useMutation({
    mutationFn: (input: Parameters<typeof createTask>[0]) => {
      if (!userId || !subId) throw new Error("Not ready");
      return createTask(input, userId, subId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof updateTask>[1] }) =>
      updateTask(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-1.5">
          <span className="size-2 bg-accent rounded-full" />
          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
            {tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length} open
          </span>
        </div>
      }
      headerActions={
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-3.5" />
          New Task
        </button>
      }
    >
      <div className="h-full flex flex-col">
        <h1 className="sr-only">Tasks</h1>
        <div className="px-6 py-4 border-b border-border flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={
                statusFilter === f.value
                  ? "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-primary text-primary-foreground"
                  : "text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {tasksQ.isLoading ? (
            <div className="p-6">
              <ListSkeleton rows={7} />
            </div>
          ) : tasksQ.isError ? (
            <ErrorState
              title="Couldn't load tasks"
              error={tasksQ.error}
              onRetry={() => tasksQ.refetch()}
              retrying={tasksQ.isFetching}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={CheckSquare}
              title={
                tasks.length === 0
                  ? "No tasks yet"
                  : `Nothing with status “${statusFilter}”`
              }
              description={
                tasks.length === 0
                  ? "Tasks keep follow-ups from slipping. Create one and assign it a due date."
                  : "Switch the status filter to see other tasks."
              }
              action={
                tasks.length === 0 ? (
                  <button
                    onClick={() => setDialogOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Plus className="size-3.5" />
                    Create your first task
                  </button>
                ) : (
                  <button
                    onClick={() => setStatusFilter("all")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary"
                  >
                    Show all tasks
                  </button>
                )
              }
            />
          ) : (

            <ul className="divide-y divide-border">
              {filtered.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  contact={t.contact_id ? contactMap.get(t.contact_id) : undefined}
                  onToggle={() =>
                    updateMut.mutate({
                      id: t.id,
                      input: { status: t.status === "done" ? "open" : "done" },
                    })
                  }
                  onStatus={(status) => updateMut.mutate({ id: t.id, input: { status } })}
                  onDelete={() => {
                    if (confirm(`Delete task "${t.title}"?`)) deleteMut.mutate(t.id);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contacts={contacts}
        onSubmit={async (input) => {
          await createMut.mutateAsync(input);
        }}
      />
    </AppShell>
  );
}

function TaskRow({
  task,
  contact,
  onToggle,
  onStatus,
  onDelete,
}: {
  task: Task;
  contact: Contact | undefined;
  onToggle: () => void;
  onStatus: (s: TaskStatus) => void;
  onDelete: () => void;
}) {
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  const overdue = task.due_at && new Date(task.due_at) < new Date() && !done && !cancelled;

  return (
    <li className="px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 sm:gap-4 hover:bg-secondary/40 transition-colors">
      <button
        onClick={onToggle}
        aria-label={done ? "Mark task as not done" : "Mark task as done"}
        className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
      >
        {done ? <CheckCircle2 className="size-4 text-accent" /> : <Circle className="size-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={"text-sm font-medium truncate " + (done ? "line-through text-muted-foreground" : "")}>
          {task.title}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
          {contact ? (
            <span className="truncate">
              {[contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contact"}
            </span>
          ) : null}
          {task.due_at ? (
            <span className={"inline-flex items-center gap-1 " + (overdue ? "text-destructive" : "")}>
              {overdue ? <AlertCircle className="size-3" /> : <Clock className="size-3" />}
              {new Date(task.due_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ) : null}
        </div>
      </div>
      <span
        className={
          "shrink-0 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded " +
          PRIORITY_CLASS[task.priority]
        }
      >
        {task.priority}
      </span>
      <Select value={task.status} onValueChange={(v) => onStatus(v as TaskStatus)}>
        <SelectTrigger aria-label="Task status" className="h-7 w-32 text-xs shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TASK_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        onClick={onDelete}
        aria-label={cancelled ? "Restore task" : "Delete task"}
        className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 sm:size-7 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
        title="Delete"
      >
        {cancelled ? <XCircle className="size-3" /> : <Trash2 className="size-3" />}
      </button>
    </li>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  contacts,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contacts: Contact[];
  onSubmit: (input: {
    title: string;
    description: string | null;
    priority: TaskPriority;
    due_at: string | null;
    contact_id: string | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueAt, setDueAt] = useState("");
  const [contactId, setContactId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueAt("");
      setContactId("none");
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        contact_id: contactId === "none" ? null : contactId,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_at">Due</Label>
              <Input id="due_at" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact">Linked contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger id="contact">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? "Saving…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
