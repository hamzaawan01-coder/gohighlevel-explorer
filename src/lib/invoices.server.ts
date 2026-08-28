/**
 * Server-only invoice delivery + reminder engine.
 *
 * Sending an invoice queues a normal `outbound_messages` email row (linked to
 * the invoice) so the existing drainer handles provider selection, retries and
 * per-message logs. Every send/schedule/payment writes an `invoice_events` row
 * so the invoice history is a real audit trail.
 */
import {
  renderInvoiceEmail,
  DEFAULT_BRANDING,
  type InvoiceBranding,
} from "./invoice-render";
import type { Invoice, InvoiceItem } from "./invoices";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Sb = Awaited<ReturnType<typeof admin>>;

export type InvoiceEventInput = {
  invoiceId: string;
  subAccountId: string;
  type: string;
  detail?: Record<string, unknown>;
  actor?: string | null;
};

/** Append to the invoice audit trail. Never throws. */
export async function logInvoiceEventServer(input: InvoiceEventInput, sb?: Sb): Promise<void> {
  try {
    const client = sb ?? (await admin());
    await client.from("invoice_events").insert({
      invoice_id: input.invoiceId,
      sub_account_id: input.subAccountId,
      type: input.type,
      detail: (input.detail ?? {}) as never,
      actor: input.actor ?? null,
    } as never);
  } catch {
    // auditing must never break the caller
  }
}

export type InvoiceBundle = {
  invoice: Invoice & {
    stripe_payment_link_url: string | null;
    reminders_enabled: boolean;
    reminder_interval_days: number;
    max_reminders: number;
  };
  items: InvoiceItem[];
  branding: InvoiceBranding;
  contact: { id: string; email: string | null; first_name: string | null; last_name: string | null } | null;
};

export async function loadInvoiceBundle(invoiceId: string, sb?: Sb): Promise<InvoiceBundle> {
  const client = sb ?? (await admin());
  const { data: invoice, error } = await client.from("invoices").select("*").eq("id", invoiceId).single();
  if (error || !invoice) throw new Error(error?.message ?? "Invoice not found");
  const inv = invoice as unknown as InvoiceBundle["invoice"];

  const { data: items } = await client
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: true });

  const { data: branding } = await client
    .from("invoice_branding")
    .select("*")
    .eq("sub_account_id", inv.sub_account_id)
    .maybeSingle();

  let contact: InvoiceBundle["contact"] = null;
  if (inv.contact_id) {
    const { data } = await client
      .from("contacts")
      .select("id,email,first_name,last_name")
      .eq("id", inv.contact_id)
      .maybeSingle();
    contact = (data as InvoiceBundle["contact"]) ?? null;
  }

  return {
    invoice: inv,
    items: (items ?? []) as unknown as InvoiceItem[],
    branding:
      (branding as InvoiceBranding | null) ?? { sub_account_id: inv.sub_account_id, ...DEFAULT_BRANDING },
    contact,
  };
}

export type QueueResult = { messageId: string; to: string };

/**
 * Queue the branded invoice email (or an overdue reminder) to the invoice
 * contact. Returns the queued message id so callers can track delivery.
 */
export async function queueInvoiceEmail(input: {
  invoiceId: string;
  toOverride?: string | null;
  reminderSequence?: number | null;
  actor?: string | null;
  sb?: Sb;
}): Promise<QueueResult> {
  const client = input.sb ?? (await admin());
  const bundle = await loadInvoiceBundle(input.invoiceId, client);
  const to = (input.toOverride || bundle.contact?.email || "").trim();
  if (!to) throw new Error("This invoice has no client email address. Pick a contact with an email first.");

  const name = [bundle.contact?.first_name, bundle.contact?.last_name].filter(Boolean).join(" ");
  const email = renderInvoiceEmail({
    invoice: bundle.invoice,
    items: bundle.items,
    branding: bundle.branding,
    recipientName: name || null,
    payUrl: bundle.invoice.stripe_payment_link_url,
    reminderSequence: input.reminderSequence ?? null,
  });

  const { data: msg, error } = await client
    .from("outbound_messages")
    .insert({
      sub_account_id: bundle.invoice.sub_account_id,
      channel: "email",
      to_address: to,
      subject: email.subject,
      body_html: email.html,
      body_text: email.text,
      contact_id: bundle.invoice.contact_id,
      invoice_id: bundle.invoice.id,
      status: "queued",
      created_by: input.actor ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !msg) throw new Error(error?.message ?? "Could not queue the invoice email");

  const messageId = (msg as { id: string }).id;

  const patch: Record<string, unknown> = { last_sent_at: new Date().toISOString() };
  if (!input.reminderSequence && bundle.invoice.status === "draft") patch['status'] = "sent";
  await client.from("invoices").update(patch as never).eq("id", bundle.invoice.id);

  await logInvoiceEventServer(
    {
      invoiceId: bundle.invoice.id,
      subAccountId: bundle.invoice.sub_account_id,
      type: input.reminderSequence ? "reminder_sent" : "sent",
      detail: { to, outbound_message_id: messageId, sequence: input.reminderSequence ?? null },
      actor: input.actor ?? null,
    },
    client,
  );

  return { messageId, to };
}

function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

export type ReminderRunResult = {
  considered: number;
  scheduled: number;
  queued: number;
  skipped: number;
  failed: number;
  errors: string[];
};

/**
 * Cron entry point: find invoices still awaiting payment past their due date,
 * schedule the next follow-up in their cadence and queue it for sending.
 */
export async function runOverdueInvoiceReminders(): Promise<ReminderRunResult> {
  const sb = await admin();
  const out: ReminderRunResult = {
    considered: 0,
    scheduled: 0,
    queued: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, error } = await sb
    .from("invoices")
    .select("id,sub_account_id,due_date,status,reminders_enabled,reminder_interval_days,max_reminders,last_sent_at")
    .eq("status", "sent")
    .eq("reminders_enabled", true)
    .not("due_date", "is", null)
    .lt("due_date", today)
    .limit(200);
  if (error) throw new Error(error.message);

  for (const raw of rows ?? []) {
    const inv = raw as unknown as {
      id: string;
      sub_account_id: string;
      due_date: string;
      reminder_interval_days: number;
      max_reminders: number;
      last_sent_at: string | null;
    };
    out.considered++;
    try {
      const { data: existing } = await sb
        .from("invoice_reminders")
        .select("id,sequence,status,scheduled_at,sent_at")
        .eq("invoice_id", inv.id)
        .order("sequence", { ascending: false });
      const reminders = (existing ?? []) as unknown as Array<{
        id: string;
        sequence: number;
        status: string;
        scheduled_at: string;
        sent_at: string | null;
      }>;

      const sentCount = reminders.filter((r) => r.status === "sent").length;
      const maxReminders = Math.max(1, inv.max_reminders ?? 3);
      if (sentCount >= maxReminders) {
        out.skipped++;
        continue;
      }

      const interval = Math.max(1, inv.reminder_interval_days ?? 3);
      const last = reminders.find((r) => r.status === "sent");
      const anchor = last?.sent_at ?? inv.last_sent_at ?? `${inv.due_date}T00:00:00.000Z`;
      const dueNext = addDays(anchor, interval);

      // Pending reminder already waiting for its slot?
      const pending = reminders.find((r) => r.status === "scheduled");
      let target = pending;

      if (!target) {
        if (dueNext > new Date()) {
          out.skipped++;
          continue;
        }
        const sequence = (reminders[0]?.sequence ?? 0) + 1;
        const { data: created, error: insErr } = await sb
          .from("invoice_reminders")
          .insert({
            invoice_id: inv.id,
            sub_account_id: inv.sub_account_id,
            sequence,
            scheduled_at: new Date().toISOString(),
            status: "scheduled",
          } as never)
          .select("id,sequence,status,scheduled_at,sent_at")
          .single();
        if (insErr || !created) throw new Error(insErr?.message ?? "Could not schedule reminder");
        out.scheduled++;
        await logInvoiceEventServer(
          {
            invoiceId: inv.id,
            subAccountId: inv.sub_account_id,
            type: "reminder_scheduled",
            detail: { sequence, due_date: inv.due_date },
          },
          sb,
        );
        target = created as unknown as typeof pending;
      }

      if (!target) continue;
      if (new Date(target.scheduled_at) > new Date()) {
        out.skipped++;
        continue;
      }

      try {
        const queued = await queueInvoiceEmail({
          invoiceId: inv.id,
          reminderSequence: target.sequence,
          sb,
        });
        await sb
          .from("invoice_reminders")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            outbound_message_id: queued.messageId,
            error: null,
          } as never)
          .eq("id", target.id);
        out.queued++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await sb
          .from("invoice_reminders")
          .update({ status: "failed", error: msg } as never)
          .eq("id", target.id);
        await logInvoiceEventServer(
          {
            invoiceId: inv.id,
            subAccountId: inv.sub_account_id,
            type: "reminder_failed",
            detail: { sequence: target.sequence, error: msg },
          },
          sb,
        );
        out.failed++;
        out.errors.push(`${inv.id}: ${msg}`);
      }
    } catch (e) {
      out.failed++;
      out.errors.push(`${inv.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return out;
}
