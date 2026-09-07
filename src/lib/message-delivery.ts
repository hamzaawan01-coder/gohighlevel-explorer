import { supabase } from "@/integrations/supabase/client";

export type DeliveryRow = {
  id: string;
  channel: "email" | "sms";
  status: "queued" | "sending" | "sent" | "failed";
  to_address: string;
  subject: string | null;
  body_text: string | null;
  provider: string | null;
  error: string | null;
  attempts: number;
  scheduled_at: string | null;
  next_attempt_at: string | null;
  sent_at: string | null;
  created_at: string;
  contact_id: string | null;
  contact_name: string | null;
};

export type DeliveryFilter = "all" | "pending" | "sent" | "failed";

/**
 * Every outbound text/email for a workspace, newest first, with the contact's
 * name resolved so the dashboard can group by lead.
 */
export async function fetchDeliveries(
  subAccountId: string,
  limit = 200,
): Promise<DeliveryRow[]> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select(
      "id, channel, status, to_address, subject, body_text, provider, error, attempts, scheduled_at, next_attempt_at, sent_at, created_at, contact_id, contacts(first_name, last_name)",
    )
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((r) => {
    const c = (r as { contacts?: { first_name: string | null; last_name: string | null } | null })
      .contacts;
    const name = c ? [c.first_name, c.last_name].filter(Boolean).join(" ").trim() : "";
    return {
      ...(r as unknown as Omit<DeliveryRow, "contact_name">),
      contact_name: name || null,
    } as DeliveryRow;
  });
}

export function filterDeliveries(rows: DeliveryRow[], f: DeliveryFilter): DeliveryRow[] {
  if (f === "all") return rows;
  if (f === "pending") return rows.filter((r) => r.status === "queued" || r.status === "sending");
  return rows.filter((r) => r.status === f);
}

export function deliveryCounts(rows: DeliveryRow[]) {
  return {
    total: rows.length,
    pending: rows.filter((r) => r.status === "queued" || r.status === "sending").length,
    sent: rows.filter((r) => r.status === "sent").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
}
