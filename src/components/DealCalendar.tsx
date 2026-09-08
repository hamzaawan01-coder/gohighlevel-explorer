import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Deal, Stage } from "@/lib/pipeline";
import { formatAmount } from "@/lib/custom-fields";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Month calendar of deals by their next action date (expected close date).
 * Drag a deal onto another day to change that date.
 */
export function DealCalendar({
  deals,
  stages,
  onSetDate,
  onOpenDeal,
}: {
  deals: Deal[];
  stages: Stage[];
  onSetDate: (dealId: string, date: string | null) => void;
  onOpenDeal: (id: string) => void;
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const days = useMemo(() => {
    const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const last = endOfMonth(month);
    const cells: Date[] = [];
    let cur = first;
    while (cur <= last || cells.length % 7 !== 0) {
      cells.push(cur);
      cur = addDays(cur, 1);
      if (cells.length > 42) break;
    }
    return cells;
  }, [month]);

  const dated = deals.filter((d) => !!d.expected_close_date);
  const undated = deals.filter((d) => !d.expected_close_date);
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "—";

  function dealsOn(day: Date) {
    return dated.filter((d) => isSameDay(new Date(d.expected_close_date!), day));
  }

  function drop(day: Date | null) {
    if (!dragId) return;
    onSetDate(dragId, day ? format(day, "yyyy-MM-dd") : null);
    setDragId(null);
    setOverKey(null);
  }

  const card = (d: Deal) => (
    <button
      key={d.id}
      draggable
      onDragStart={() => setDragId(d.id)}
      onDragEnd={() => setDragId(null)}
      onClick={() => onOpenDeal(d.id)}
      title={`${d.title} · ${stageName(d.stage_id)}`}
      className="w-full cursor-grab truncate rounded border border-border bg-card px-1.5 py-1 text-left text-[10px] font-medium hover:bg-secondary active:cursor-grabbing"
    >
      {d.title} · {formatAmount(d.value, d.currency)}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMonth(addMonths(month, -1))}
          aria-label="Previous month"
          className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-secondary"
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="min-w-[9rem] text-center text-sm font-semibold">
          {format(month, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setMonth(addMonths(month, 1))}
          aria-label="Next month"
          className="flex size-8 items-center justify-center rounded-md border border-border hover:bg-secondary"
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          onClick={() => setMonth(startOfMonth(new Date()))}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
        >
          Today
        </button>
        <p className="ml-auto text-[11px] text-muted-foreground">
          Drag a deal onto a day to set its next action date.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="grid grid-cols-7 gap-px rounded-t-lg border border-border bg-border text-center">
          {DAY_LABELS.map((d) => (
            <div key={d} className="bg-card py-1.5 text-[10px] font-bold uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px rounded-b-lg border border-t-0 border-border bg-border">
          {days.map((day) => {
            const key = day.toISOString();
            const items = dealsOn(day);
            return (
              <div
                key={key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverKey(key);
                }}
                onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
                onDrop={() => drop(day)}
                className={`min-h-[6.5rem] space-y-1 p-1.5 ${
                  overKey === key ? "bg-secondary" : "bg-card"
                } ${isSameMonth(day, month) ? "" : "opacity-50"}`}
              >
                <div
                  className={`text-[10px] font-semibold ${
                    isToday(day) ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </div>
                {items.map(card)}
              </div>
            );
          })}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOverKey("none");
        }}
        onDragLeave={() => setOverKey((k) => (k === "none" ? null : k))}
        onDrop={() => drop(null)}
        className={`rounded-lg border border-dashed border-border p-3 ${
          overKey === "none" ? "bg-secondary" : ""
        }`}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          No date yet · {undated.length} — drop here to clear a date
        </p>
        <div className="flex flex-wrap gap-1.5">
          {undated.map((d) => (
            <span key={d.id} className="max-w-[14rem]">
              {card(d)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
