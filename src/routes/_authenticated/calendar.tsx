import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useTenancy } from "@/lib/tenancy";
import { fetchEvents, createEvent, deleteEvent, type EventInput } from "@/lib/calendar";
import { fetchTasks } from "@/lib/tasks";
import { fetchContacts } from "@/lib/contacts";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Agency Engine" },
      { name: "description", content: "Events, meetings, and task due dates." },
    ],
  }),
  component: CalendarPage,
});

type DayItem =
  | { kind: "event"; id: string; title: string; when: Date; ref?: string }
  | { kind: "task"; id: string; title: string; when: Date };

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function CalendarPage() {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [userId, setUserId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);

  const eventsQ = useQuery({
    queryKey: ["calendar-events", subId, monthStart.toISOString()],
    queryFn: () => fetchEvents(subId!, monthStart.toISOString(), monthEnd.toISOString()),
    enabled: !!subId,
  });
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

  const events = eventsQ.data ?? [];
  const tasks = tasksQ.data ?? [];
  const contacts = contactsQ.data ?? [];

  const itemsByDay = useMemo(() => {
    const m = new Map<string, DayItem[]>();
    const push = (d: Date, item: DayItem) => {
      const k = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = m.get(k) ?? [];
      arr.push(item);
      m.set(k, arr);
    };
    events.forEach((e) => {
      const d = new Date(e.starts_at);
      push(d, { kind: "event", id: e.id, title: e.title, when: d });
    });
    tasks.forEach((t) => {
      if (!t.due_at || t.status === "done" || t.status === "cancelled") return;
      const d = new Date(t.due_at);
      if (d >= monthStart && d <= monthEnd) push(d, { kind: "task", id: t.id, title: t.title, when: d });
    });
    return m;
  }, [events, tasks, monthStart, monthEnd]);

  const createMut = useMutation({
    mutationFn: (input: EventInput) => {
      if (!userId || !subId) throw new Error("Not ready");
      return createEvent(input, userId, subId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event created");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Event deleted");
    },
  });

  // Build the calendar grid (Mon-Sun)
  const firstDayOffset = (monthStart.getDay() + 6) % 7; // 0 = Mon
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - firstDayOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const selectedItems = itemsByDay.get(`${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`) ?? [];
  selectedItems.sort((a, b) => a.when.getTime() - b.when.getTime());

  return (
    <AppShell
      headerStatus={
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          {monthLabel(cursor)}
        </span>
      }
      headerActions={
        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="size-3.5" /> New Event
        </button>
      }
    >
      <div className="h-full flex">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border">
            <button
              onClick={() => setCursor(addMonths(cursor, -1))}
              className="size-7 rounded hover:bg-secondary flex items-center justify-center"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-sm font-semibold">{monthLabel(cursor)}</span>
            <button
              onClick={() => setCursor(addMonths(cursor, 1))}
              className="size-7 rounded hover:bg-secondary flex items-center justify-center"
            >
              <ChevronRight className="size-3.5" />
            </button>
            <button
              onClick={() => { const now = new Date(); setCursor(now); setSelected(now); }}
              className="ml-2 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-secondary text-muted-foreground hover:text-foreground"
            >
              Today
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-7 border-b border-border sticky top-0 bg-card">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 auto-rows-[minmax(88px,1fr)]">
              {days.map((d) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const isToday = isSameDay(d, new Date());
                const isSelected = isSameDay(d, selected);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const items = itemsByDay.get(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`) ?? [];
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => setSelected(d)}
                    className={
                      "border-b border-r border-border p-1.5 text-left flex flex-col gap-1 transition-colors " +
                      (isSelected ? "bg-accent/10 " : isWeekend ? "bg-secondary/20 hover:bg-secondary/40 " : "hover:bg-secondary/40 ") +
                      (inMonth ? "" : "opacity-40")
                    }
                  >
                    <div className="flex items-center justify-between w-full">
                      {items.length > 0 ? (
                        <span className="text-[9px] font-mono text-muted-foreground">{items.length}</span>
                      ) : (
                        <span />
                      )}
                      <span
                        className={
                          "text-[11px] font-semibold " +
                          (isToday ? "bg-primary text-primary-foreground rounded-full size-5 flex items-center justify-center" : "")
                        }
                      >
                        {d.getDate()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {items.slice(0, 3).map((it) => (
                        <span
                          key={it.kind + it.id}
                          className={
                            "text-[10px] truncate rounded px-1 py-0.5 " +
                            (it.kind === "event"
                              ? "bg-accent/20 text-accent"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400")
                          }
                        >
                          {it.title}
                        </span>
                      ))}
                      {items.length > 3 && (
                        <span className="text-[9px] text-muted-foreground">+{items.length - 3} more</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 px-6 py-2 border-t border-border text-[10px] font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-accent/40" /> Event
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-amber-500/40" /> Task due
              </span>
            </div>
          </div>
        </div>

        <aside className="w-80 border-l border-border bg-card flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex-1 overflow-auto">
            {eventsQ.isLoading ? (
              <div className="p-4 flex items-center text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin mr-2" /> Loading…
              </div>
            ) : selectedItems.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground italic">Nothing scheduled.</div>
            ) : (
              <ul className="divide-y divide-border">
                {selectedItems.map((it) => (
                  <li key={it.kind + it.id} className="px-4 py-3 flex items-start gap-2">
                    <span
                      className={
                        "text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded " +
                        (it.kind === "event" ? "bg-accent/20 text-accent" : "bg-amber-500/10 text-amber-600")
                      }
                    >
                      {it.kind === "event" ? "Event" : "Task"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{it.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {it.when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    {it.kind === "event" && (
                      <button
                        onClick={() => { if (confirm(`Delete "${it.title}"?`)) deleteMut.mutate(it.id); }}
                        className="text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultDate={selected}
        contacts={contacts}
        onSubmit={async (input) => { await createMut.mutateAsync(input); }}
      />
    </AppShell>
  );
}

function EventDialog({
  open,
  onOpenChange,
  defaultDate,
  contacts,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultDate: Date;
  contacts: { id: string; first_name: string | null; last_name: string | null; email: string | null }[];
  onSubmit: (input: EventInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [contactId, setContactId] = useState("none");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = new Date(defaultDate);
    s.setHours(9, 0, 0, 0);
    const e = new Date(defaultDate);
    e.setHours(10, 0, 0, 0);
    setTitle("");
    setDescription("");
    setStartsAt(toLocalInput(s));
    setEndsAt(toLocalInput(e));
    setContactId("none");
  }, [open, defaultDate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt || !endsAt) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: new Date(endsAt).toISOString(),
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
          <DialogTitle>New event</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="starts_at">Starts</Label>
              <Input id="starts_at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ends_at">Ends</Label>
              <Input id="ends_at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Linked contact</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? "Saving…" : "Create event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
