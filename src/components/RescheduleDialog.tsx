import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchRescheduleOptions, rescheduleAppointment, type Appointment } from "@/lib/appointments";
import { ErrorState, ListSkeleton } from "@/components/ui/states";

/** Reschedule an appointment to another free slot (availability re-checked server-side). */
export function RescheduleDialog({
  appointment,
  onOpenChange,
}: {
  appointment: Appointment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [picked, setPicked] = useState<string | null>(null);
  const token = appointment?.reschedule_token ?? null;

  const optionsQ = useQuery({
    queryKey: ["reschedule-options", token],
    queryFn: () => fetchRescheduleOptions(token!),
    enabled: !!token,
  });

  const mut = useMutation({
    mutationFn: (startsAt: string) => rescheduleAppointment(token!, startsAt),
    onSuccess: (res) => {
      toast.success(
        `Rescheduled${res.reminders_moved ? ` · ${res.reminders_moved} reminder(s) moved` : ""}`,
      );
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appointment-reminders"] });
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      qc.invalidateQueries({ queryKey: ["appointment-audit"] });
      setPicked(null);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const slots = optionsQ.data?.slots ?? [];

  return (
    <Dialog open={!!appointment} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule appointment</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.title} — currently ${new Date(appointment.starts_at).toLocaleString()}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {!token ? (
          <p className="text-sm text-muted-foreground">
            This appointment has no booking link, so it can only be edited on the calendar.
          </p>
        ) : optionsQ.isLoading ? (
          <ListSkeleton rows={4} />
        ) : optionsQ.isError ? (
          <ErrorState compact onRetry={() => optionsQ.refetch()} />
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No free slots inside the booking window right now.
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Available times"
            className="max-h-72 overflow-auto grid grid-cols-2 gap-1.5 pr-1"
          >
            {slots.slice(0, 60).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={picked === s}
                onClick={() => setPicked(s)}
                className={`rounded-md border px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  picked === s
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:bg-secondary"
                }`}
              >
                {new Date(s).toLocaleString(undefined, {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!picked || mut.isPending}
            onClick={() => picked && mut.mutate(picked)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {mut.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Confirm new time
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
