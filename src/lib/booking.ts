import { supabase } from "@/integrations/supabase/client";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type TimeWindow = { start: string; end: string }; // "HH:MM"
export type Availability = Record<DayKey, TimeWindow[]>;

export const DEFAULT_AVAILABILITY: Availability = {
  mon: [{ start: "09:00", end: "17:00" }],
  tue: [{ start: "09:00", end: "17:00" }],
  wed: [{ start: "09:00", end: "17:00" }],
  thu: [{ start: "09:00", end: "17:00" }],
  fri: [{ start: "09:00", end: "17:00" }],
  sat: [],
  sun: [],
};

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

export type BookingPage = {
  id: string;
  sub_account_id: string;
  owner_user_id: string;
  slug: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  advance_days: number;
  min_notice_minutes: number;
  timezone: string;
  availability: Availability;
  enabled: boolean;
  reminder_offsets: number[];
  reminder_channel: "sms" | "email" | "both";
  reminder_template: string | null;
  confirmation_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchBookingPages(subAccountId: string): Promise<BookingPage[]> {
  const { data, error } = await supabase
    .from("booking_pages" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as BookingPage[];
}

export async function upsertBookingPage(input: Partial<BookingPage> & { sub_account_id: string; owner_user_id: string; slug: string; name: string }) {
  const { data, error } = await supabase
    .from("booking_pages" as never)
    .upsert(input as never, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as BookingPage;
}

export async function deleteBookingPage(id: string) {
  const { error } = await supabase.from("booking_pages" as never).delete().eq("id", id);
  if (error) throw error;
}

export type PublicBookingPage = Pick<
  BookingPage,
  "slug" | "name" | "description" | "duration_minutes" | "buffer_minutes" | "advance_days" | "min_notice_minutes" | "timezone" | "availability" | "enabled"
>;

export async function fetchPublicBookingPage(slug: string): Promise<{ page: PublicBookingPage; slots: string[] } | null> {
  const res = await fetch(`/api/public/booking/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { page: PublicBookingPage; slots: string[] };
}

export async function submitBooking(slug: string, input: {
  starts_at: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}) {
  const res = await fetch(`/api/public/booking/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { ok: true };
}
