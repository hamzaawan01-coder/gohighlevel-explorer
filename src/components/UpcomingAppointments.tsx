import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarClock, Bell, BellOff, AlertTriangle, Check, X, CalendarSync } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  fetchUpcomingAppointments,
  fetchRemindersForEvents,
  setAppointmentStatus,
  offsetLabel,
  reminderChannelLabel,
  type Appointment,
  type ReminderRow,
} from "@/lib/appointments";
import { ListSkeleton, EmptyState, ErrorState } from "@/components/ui/states";
import { RescheduleDialog } from "@/components/RescheduleDialog";

/** Upcoming booked appointments with per-appointment reminder status. */
export function UpcomingAppointments({ subAccountId }: { subAccountId: string | null }) {
  const qc = useQueryClient();
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);

  const apptQ = useQuery({
    queryKey: ["appointments", subAccountId],
    queryFn: () => fetchUpcomingAppointments(subAccountId!),
    enabled: !!subAccountId,
  });

  const appointments = apptQ.data ?? [];
  const ids = useMemo(() => appointments.map((a) => a.id), [appointments]);

  const remindersQ = useQuery({
    queryKey: ["appointment-reminders", ids.join(",")],
    queryFn: () => fetchRemindersForEvents(ids),
    enabled: ids.length > 0,
  });

  const byEvent = useMemo(() => {
    const m = new Map<string, ReminderRow[]>();
    for (const r of remindersQ.data ?? []) {
      m.set(r.event_id, [...(m.get(r.event_id) ?? []), r]);
    }
    return m;
  }, [remindersQ.data]);

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Appointment["status"] }) =>
      setAppointmentStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments", subAccountId] });
      qc.invalidateQueries({ queryKey: ["appointment-reminders"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("Appointment updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (apptQ.isError) {
    return (
      <div className="p-4">
        <ErrorState compact onRetry={() => apptQ.refetch()} />
      </div>
    );
  }
  if (apptQ.isLoading) {
    return (
      <div className="p-4">
        <ListSkeleton rows={3} />
      </div>
    );
  }
  if (appointments.length === 0) {
    return (
      <EmptyState
        compact
        icon={CalendarClock}
        title="No upcoming appointments"
        description="Share a booking link and confirmed bookings appear here with their reminders."
      />
    );
  }

  return (
    <>
    <ul className="divide-y divide-border">
      {appointments.map((a) => {
        const reminders = byEvent.get(a.id) ?? [];
        const cancelled = a.status === "cancelled";
        return (
          <li key={a.id} className="px-4 py-3 space-y-1.5">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${cancelled ? "line-through opacity-60" : ""}`}>
                  {a.title}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(a.starts_at).toLocaleString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  · {formatDistanceToNow(new Date(a.starts_at), { addSuffix: true })}
                </p>
              </div>
              {!cancelled && (
                <div className="flex items-center gap-0.5">
                  {a.reschedule_token && (
                    <button
                      type="button"
                      title="Reschedule"
                      aria-label={`Reschedule ${a.title}`}
                      onClick={() => setRescheduling(a)}
                      className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <CalendarSync className="size-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Mark completed"
                    aria-label={`Mark ${a.title} completed`}
                    disabled={statusMut.isPending}
                    onClick={() => statusMut.mutate({ id: a.id, status: "completed" })}
                    className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Cancel appointment (stops reminders)"
                    aria-label={`Cancel ${a.title}`}
                    disabled={statusMut.isPending}
                    onClick={() => {
                      if (confirm(`Cancel "${a.title}"? Pending reminders will not be sent.`)) {
                        statusMut.mutate({ id: a.id, status: "cancelled" });
                      }
                    }}
                    className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            {a.rescheduled_at && (
              <p className="text-[10px] text-muted-foreground">
                Rescheduled{a.original_starts_at ? ` from ${new Date(a.original_starts_at).toLocaleString()}` : ""}
              </p>
            )}
            {(a.attendee_email || a.attendee_phone) && (
              <p className="text-[10px] text-muted-foreground truncate">
                {[a.attendee_email, a.attendee_phone].filter(Boolean).join(" · ")}
              </p>
            )}

            {reminders.length === 0 ? (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <BellOff className="size-3" /> No reminders scheduled
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {reminders.map((r) => (
                  <span
                    key={r.id}
                    title={r.error ?? `${r.channel} · ${r.status}`}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                      r.status === "failed"
                        ? "bg-destructive/10 text-destructive"
                        : r.status === "queued"
                        ? "bg-primary/10 text-primary"
                        : r.status === "skipped"
                        ? "bg-muted text-muted-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {r.status === "failed" ? <AlertTriangle className="size-2.5" /> : <Bell className="size-2.5" />}
                    {offsetLabel(r.offset_minutes)} · {reminderChannelLabel(r.channel)} ·{" "}
                    {r.delivery_status ?? r.status}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
    <RescheduleDialog
      appointment={rescheduling}
      onOpenChange={(open) => { if (!open) setRescheduling(null); }}
    />
    </>
  );
}
