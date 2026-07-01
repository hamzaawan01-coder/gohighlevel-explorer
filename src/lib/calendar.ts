import { supabase } from "@/integrations/supabase/client";

export type CalendarEvent = {
  id: string;
  sub_account_id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  contact_id: string | null;
  deal_id: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export type EventInput = {
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  location?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
};

export async function fetchEvents(subAccountId: string, fromISO: string, toISO: string): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .gte("starts_at", fromISO)
    .lte("starts_at", toISO)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

export async function createEvent(input: EventInput, ownerUserId: string, subAccountId: string) {
  const { data, error } = await supabase
    .from("calendar_events")
    .insert({ ...input, owner_user_id: ownerUserId, sub_account_id: subAccountId })
    .select("*")
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function updateEvent(id: string, input: Partial<EventInput>) {
  const { data, error } = await supabase
    .from("calendar_events")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as CalendarEvent;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}
