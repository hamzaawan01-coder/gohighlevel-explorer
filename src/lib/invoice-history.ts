import { supabase } from "@/integrations/supabase/client";

export type InvoiceEventType =
  | "created"
  | "sent"
  | "send_failed"
  | "reminder_scheduled"
  | "reminder_sent"
  | "reminder_failed"
  | "payment_link_created"
  | "paid"
  | "status_changed";

export type InvoiceEvent = {
  id: string;
  invoice_id: string;
  sub_account_id: string;
  type: string;
  detail: Record<string, unknown>;
  actor: string | null;
  created_at: string;
};

export type InvoiceReminder = {
  id: string;
  invoice_id: string;
  sub_account_id: string;
  sequence: number;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
  error: string | null;
  outbound_message_id: string | null;
};

export type InvoiceDelivery = {
  id: string;
  to_address: string;
  status: string;
  provider: string | null;
  error: string | null;
  attempts: number;
  sent_at: string | null;
  created_at: string;
};

export async function fetchInvoiceEvents(invoiceId: string): Promise<InvoiceEvent[]> {
  const { data, error } = await supabase
    .from("invoice_events")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceEvent[];
}

export async function fetchInvoiceReminders(invoiceId: string): Promise<InvoiceReminder[]> {
  const { data, error } = await supabase
    .from("invoice_reminders")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("sequence", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceReminder[];
}

/** Queued/sent emails for this invoice, so delivery status is visible in-app. */
export async function fetchInvoiceDeliveries(invoiceId: string): Promise<InvoiceDelivery[]> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select("id,to_address,status,provider,error,attempts,sent_at,created_at")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceDelivery[];
}

export async function logInvoiceEvent(input: {
  invoiceId: string;
  subAccountId: string;
  type: InvoiceEventType;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("invoice_events").insert({
    invoice_id: input.invoiceId,
    sub_account_id: input.subAccountId,
    type: input.type,
    detail: (input.detail ?? {}) as never,
    actor: auth.user?.id ?? null,
  });
}
