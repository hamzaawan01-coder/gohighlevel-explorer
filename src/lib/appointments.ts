import { supabase } from "@/integrations/supabase/client";

export type AppointmentStatus = "confirmed" | "cancelled" | "no_show" | "completed";

export type Appointment = {
  id: string;
  sub_account_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  location: string | null;
  contact_id: string | null;
  booking_page_id: string | null;
  attendee_email: string | null;
  attendee_phone: string | null;
  reschedule_token: string | null;
  rescheduled_at: string | null;
  original_starts_at: string | null;
};

export type ReminderChannel = "sms" | "email" | "in_app";

export type ReminderRow = {
  id: string;
  event_id: string;
  offset_minutes: number;
  channel: ReminderChannel;
  status: "pending" | "queued" | "skipped" | "failed";
  scheduled_for: string;
  error: string | null;
  delivery_status: "sent" | "delivered" | "failed" | null;
  delivered_at: string | null;
};

export type AuditAction =
  | "booked"
  | "rescheduled"
  | "edited"
  | "cancelled"
  | "status_changed"
  | "reminder_sent"
  | "reminder_failed"
  | "reminder_skipped";

export const AUDIT_ACTIONS: { key: AuditAction; label: string }[] = [
  { key: "booked", label: "Booked" },
  { key: "rescheduled", label: "Rescheduled" },
  { key: "edited", label: "Edited" },
  { key: "cancelled", label: "Cancelled" },
  { key: "status_changed", label: "Status changed" },
  { key: "reminder_sent", label: "Reminder sent" },
  { key: "reminder_failed", label: "Reminder failed" },
  { key: "reminder_skipped", label: "Reminder skipped" },
];

export type AuditEntry = {
  id: string;
  sub_account_id: string;
  event_id: string | null;
  booking_page_id: string | null;
  contact_id: string | null;
  action: AuditAction;
  actor_label: string | null;
  channel: string | null;
  detail: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const APPT_COLUMNS =
  "id, sub_account_id, title, description, starts_at, ends_at, status, location, contact_id, booking_page_id, attendee_email, attendee_phone, reschedule_token, rescheduled_at, original_starts_at";

export const REMINDER_PRESETS: { label: string; minutes: number }[] = [
  { label: "1 week before", minutes: 10080 },
  { label: "2 days before", minutes: 2880 },
  { label: "24 hours before", minutes: 1440 },
  { label: "2 hours before", minutes: 120 },
  { label: "1 hour before", minutes: 60 },
  { label: "15 minutes before", minutes: 15 },
];

export function offsetLabel(minutes: number): string {
  const preset = REMINDER_PRESETS.find((p) => p.minutes === minutes);
  if (preset) return preset.label;
  if (minutes % 1440 === 0) return `${minutes / 1440} day(s) before`;
  if (minutes % 60 === 0) return `${minutes / 60} hour(s) before`;
  return `${minutes} min before`;
}

/** Upcoming appointments (booked or manually created) for a workspace. */
export async function fetchUpcomingAppointments(
  subAccountId: string,
  limit = 50,
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select(APPT_COLUMNS)
    .eq("sub_account_id", subAccountId)
    .gte("starts_at", new Date(Date.now() - 60 * 60_000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Appointment[];
}

export async function fetchRemindersForEvents(eventIds: string[]): Promise<ReminderRow[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await supabase
    .from("appointment_reminders" as never)
    .select(
      "id, event_id, offset_minutes, channel, status, scheduled_for, error, delivery_status, delivered_at",
    )
    .in("event_id", eventIds)
    .order("scheduled_for", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ReminderRow[];
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus) {
  const { error } = await supabase
    .from("calendar_events")
    .update({ status } as never)
    .eq("id", id);
  if (error) throw error;
  if (status === "cancelled") {
    // Stop any reminder that hasn't gone out yet.
    await supabase
      .from("appointment_reminders" as never)
      .update({ status: "skipped", error: "Appointment cancelled" } as never)
      .eq("event_id", id)
      .eq("status", "pending");
  }
}

export function reminderChannelLabel(channel: ReminderChannel): string {
  return channel === "in_app" ? "In-app" : channel.toUpperCase();
}

/** Public reschedule link for an appointment, if the booking page allows it. */
export function rescheduleUrl(appointment: Appointment): string | null {
  return appointment.reschedule_token
    ? `/booking/reschedule/${appointment.reschedule_token}`
    : null;
}

export type AuditFilters = {
  actions?: AuditAction[];
  eventId?: string | null;
  search?: string;
  from?: string | null;
  to?: string | null;
};

/** Appointment activity log, newest first. */
export async function fetchAppointmentAudit(
  subAccountId: string,
  filters: AuditFilters = {},
  limit = 200,
): Promise<AuditEntry[]> {
  let q = supabase
    .from("appointment_audit" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters.actions && filters.actions.length > 0) q = q.in("action", filters.actions);
  if (filters.eventId) q = q.eq("event_id", filters.eventId);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as unknown as AuditEntry[];
  return filterAuditRows(rows, filters.search);
}

/** Client-side free-text filter over audit rows (exported for tests). */
export function filterAuditRows(rows: AuditEntry[], search?: string): AuditEntry[] {
  const q = search?.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) =>
    [r.action, r.detail, r.actor_label, r.channel]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  );
}

/** Reschedule from inside the CRM: availability is re-checked server-side. */
export async function rescheduleAppointment(
  token: string,
  startsAt: string,
): Promise<{ starts_at: string; reminders_moved: number }> {
  const res = await fetch(`/api/public/booking/reschedule/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ starts_at: startsAt }),
  });
  if (!res.ok) throw new Error((await res.text()) || "Could not reschedule");
  return res.json();
}

export async function fetchRescheduleOptions(token: string): Promise<{
  appointment: { title: string; starts_at: string; timezone: string };
  page: { name: string; duration_minutes: number };
  slots: string[];
}> {
  const res = await fetch(`/api/public/booking/reschedule/${token}`);
  if (!res.ok) throw new Error("Reschedule link is not available");
  return res.json();
}
