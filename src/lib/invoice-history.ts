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

export type InvoiceRender = {
  id: string;
  invoice_id: string;
  sub_account_id: string;
  template_id: string | null;
  template_name: string | null;
  template_version: number | null;
  branding_snapshot: Record<string, unknown>;
  html: string;
  source: string;
  reminder_sequence: number | null;
  created_at: string;
};

/** Every generated document (email, reminder, print) for this invoice. */
export async function fetchInvoiceRenders(invoiceId: string): Promise<InvoiceRender[]> {
  const { data, error } = await supabase
    .from("invoice_renders")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as InvoiceRender[];
}

/** Store a rendered document so it can be re-opened or downloaded later. */
export async function recordInvoiceRender(input: {
  invoiceId: string;
  subAccountId: string;
  templateId?: string | null;
  templateName?: string | null;
  templateVersion?: number | null;
  brandingSnapshot: Record<string, unknown>;
  invoiceSnapshot?: Record<string, unknown>;
  html: string;
  source: "print" | "email" | "reminder";
  reminderSequence?: number | null;
}): Promise<void> {
  const auth = await supabase.auth.getUser();
  const { error } = await supabase.from("invoice_renders").insert({
    invoice_id: input.invoiceId,
    sub_account_id: input.subAccountId,
    template_id: input.templateId ?? null,
    template_name: input.templateName ?? null,
    template_version: input.templateVersion ?? null,
    branding_snapshot: input.brandingSnapshot as never,
    invoice_snapshot: (input.invoiceSnapshot ?? {}) as never,
    html: input.html,
    source: input.source,
    reminder_sequence: input.reminderSequence ?? null,
    created_by: auth.data.user?.id ?? null,
  } as never);
  if (error) throw error;
}

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
