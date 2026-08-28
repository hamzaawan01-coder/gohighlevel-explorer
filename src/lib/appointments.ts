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
};

export type ReminderRow = {
  id: string;
  event_id: string;
  offset_minutes: number;
  channel: "sms" | "email";
  status: "pending" | "queued" | "skipped" | "failed";
  scheduled_for: string;
  error: string | null;
};

const APPT_COLUMNS =
  "id, sub_account_id, title, description, starts_at, ends_at, status, location, contact_id, booking_page_id, attendee_email, attendee_phone";

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
    .select("id, event_id, offset_minutes, channel, status, scheduled_for, error")
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
