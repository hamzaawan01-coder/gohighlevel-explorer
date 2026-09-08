import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, CheckSquare, Flag, GripVertical, StickyNote } from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { toast } from "sonner";
import { useTenancy } from "@/lib/tenancy";
import { fetchEvents, updateEvent } from "@/lib/calendar";
import { fetchTasks, updateTask } from "@/lib/tasks";
import { updateDeal, type Deal } from "@/lib/pipeline";

type Kind = "close" | "meeting" | "task" | "note";

type Item = {
  id: string;
  kind: Kind;
  title: string;
  detail?: string | null;
  date: Date;
  movable: boolean;
};

const ICONS: Record<Kind, React.ComponentType<{ className?: string }>> = {
  close: Flag,
  meeting: CalendarDays,
  task: CheckSquare,
  note: StickyNote,
};

const LABELS: Record<Kind, string> = {
  close: "Next action / close date",
  meeting: "Meeting",
  task: "Task",
  note: "Note",
};

/**
 * Key dates, meetings, tasks and notes for one deal on a draggable timeline.
 * Drag an item onto another day to move it.
 */
export function DealTimeline({ deal }: { deal: Deal }) {
  const qc = useQueryClient();
  const subId = useTenancy((s) => s.currentSubAccountId);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const eventsQ = useQuery({
    queryKey: ["deal-events", subId, deal.id],
    enabled: !!subId,
    queryFn: async () => {
      const all = await fetchEvents(
        subId!,
        addDays(new Date(), -365).toISOString(),
        addDays(new Date(), 365).toISOString(),
      );
      return all.filter((e) => e.deal_id === deal.id);
    },
  });

  const tasksQ = useQuery({
    queryKey: ["tasks", subId],
    enabled: !!subId,
    queryFn: () => fetchTasks(subId!),
  });

  const events = eventsQ.data ?? [];
  const tasks = (tasksQ.data ?? []).filter((t) => t.deal_id === deal.id && t.due_at);

  const items: Item[] = useMemo(() => {
    const list: Item[] = [
      {
        id: `created-${deal.id}`,
        kind: "note",
        title: "Deal created",
        date: new Date(deal.created_at),
        movable: false,
      },
    ];
    if (deal.expected_close_date)
      list.push({
        id: `close-${deal.id}`,
        kind: "close",
        title: "Next action / expected close",
        date: new Date(deal.expected_close_date),
        movable: true,
      });
    for (const e of events)
      list.push({
        id: `event-${e.id}`,
        kind: "meeting",
        title: e.title,
        detail: e.all_day ? "All day" : format(new Date(e.starts_at), "HH:mm"),
        date: new Date(e.starts_at),
        movable: true,
      });
    for (const t of tasks)
      list.push({
        id: `task-${t.id}`,
        kind: "task",
        title: t.title,
        detail: t.status === "done" ? "Done" : t.priority,
        date: new Date(t.due_at!),
        movable: true,
      });
    if (deal.notes?.trim())
      list.push({
        id: `notes-${deal.id}`,
        kind: "note",
        title: "Notes",
        detail: deal.notes.slice(0, 140),
        date: new Date(deal.updated_at),
        movable: false,
      });
    return list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [deal, events, tasks]);

  const moveMut = useMutation({
    mutationFn: async ({ itemId, date }: { itemId: string; date: Date }) => {
      const iso = date.toISOString();
      if (itemId.startsWith("close-")) {
        await updateDeal(deal.id, { expected_close_date: format(date, "yyyy-MM-dd") });
      } else if (itemId.startsWith("event-")) {
        const id = itemId.slice("event-".length);
        const ev = events.find((e) => e.id === id);
        if (!ev) return;
        const len = new Date(ev.ends_at).getTime() - new Date(ev.starts_at).getTime();
        const start = new Date(date);
        const old = new Date(ev.starts_at);
        start.setHours(old.getHours(), old.getMinutes(), 0, 0);
        await updateEvent(id, {
          starts_at: start.toISOString(),
          ends_at: new Date(start.getTime() + Math.max(len, 0)).toISOString(),
        });
      } else if (itemId.startsWith("task-")) {
        await updateTask(itemId.slice("task-".length), { due_at: iso });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", deal.id] });
      qc.invalidateQueries({ queryKey: ["deal-events", subId, deal.id] });
      qc.invalidateQueries({ queryKey: ["tasks", subId] });
      qc.invalidateQueries({ queryKey: ["board"] });
      toast.success("Moved");
    },
    onError: (e: Error) => toast.error(e.message || "Could not move that"),
  });

  // Lanes: two weeks around today, plus any days that already carry items.
  const days = useMemo(() => {
    const base = Array.from({ length: 14 }, (_, i) => startOfDay(addDays(new Date(), i - 3)));
    for (const it of items) {
      const d = startOfDay(it.date);
      if (!base.some((b) => isSameDay(b, d))) base.push(d);
    }
    return base.sort((a, b) => a.getTime() - b.getTime());
  }, [items]);

  function drop(day: Date) {
    if (!dragId) return;
    moveMut.mutate({ itemId: dragId, date: day });
    setDragId(null);
    setOverKey(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Every key date for this deal. Drag a meeting, task or the close date onto another day to
        move it.
      </p>
      <ol className="space-y-px overflow-hidden rounded-lg border border-border">
        {days.map((day) => {
          const key = day.toISOString();
          const dayItems = items.filter((i) => isSameDay(i.date, day));
          return (
            <li
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                setOverKey(key);
              }}
              onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
              onDrop={() => drop(day)}
              className={`flex gap-3 border-b border-border px-3 py-2 last:border-b-0 ${
                overKey === key ? "bg-secondary" : ""
              }`}
            >
              <div className="w-20 shrink-0 pt-0.5">
                <p className="text-[11px] font-semibold">{format(day, "d MMM")}</p>
                <p className="text-[10px] text-muted-foreground">{format(day, "EEE")}</p>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                {dayItems.length === 0 ? (
                  <p className="text-[10px] italic text-muted-foreground">—</p>
                ) : (
                  dayItems.map((it) => {
                    const Icon = ICONS[it.kind];
                    return (
                      <div
                        key={it.id}
                        draggable={it.movable}
                        onDragStart={() => it.movable && setDragId(it.id)}
                        onDragEnd={() => setDragId(null)}
                        className={`flex items-start gap-2 rounded-md border border-border bg-card px-2 py-1.5 ${
                          it.movable ? "cursor-grab active:cursor-grabbing" : ""
                        }`}
                      >
                        {it.movable ? (
                          <GripVertical className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                        ) : (
                          <span className="w-3 shrink-0" />
                        )}
                        <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{it.title}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {LABELS[it.kind]}
                            {it.detail ? ` · ${it.detail}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
