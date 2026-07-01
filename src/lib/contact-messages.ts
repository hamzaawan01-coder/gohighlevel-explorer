import { supabase } from "@/integrations/supabase/client";
import type { Message } from "@/lib/conversations";

/** Fetch the most recent messages across all channels for a contact. */
export async function fetchContactMessages(
  contactId: string,
  limit = 20,
): Promise<Message[]> {
  const { data: convs, error: cErr } = await supabase
    .from("conversations")
    .select("id")
    .eq("contact_id", contactId);
  if (cErr) throw cErr;
  const ids = (convs ?? []).map((c) => c.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Message[];
}
