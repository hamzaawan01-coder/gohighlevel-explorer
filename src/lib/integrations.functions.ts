import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SmtpConfig, ResendConfig, SendGridConfig, TwilioConfig } from "./integrations";

async function assertAdminAccess(supabase: ReturnType<typeof getSupabase>, subAccountId: string) {
  const { data, error } = await supabase
    .from("sub_account_integrations")
    .select("sub_account_id")
    .eq("sub_account_id", subAccountId)
    .maybeSingle();
  // RLS blocks non-admins from reading; if the query errored on permission we still
  // fall through to the send call which will also be permission-guarded on the FK.
  if (error) throw new Error("Not authorized for this workspace");
  return data;
}

// helper type so the file typechecks without importing the concrete supabase-js client here
type SupabaseLike = ReturnType<typeof getSupabase>;
function getSupabase() {
  return null as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (col: string, v: string) => {
          maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
  };
}

// ============ Test send: email ============
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sub_account_id: string;
      to: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("sub_account_integrations")
      .select("*")
      .eq("sub_account_id", data.sub_account_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.email_provider) throw new Error("No email provider configured");
    if (!row.email_from_address) throw new Error("Missing from address");

    const { sendEmailViaProvider } = await import("./integrations.server");
    const result = await sendEmailViaProvider({
      provider: row.email_provider as "smtp" | "resend" | "sendgrid",
      config: row.email_config as SmtpConfig | ResendConfig | SendGridConfig,
      from: row.email_from_address,
      fromName: row.email_from_name,
      to: data.to,
      subject: "Test email from your CRM",
      html: `<p>This is a test email sent from your CRM using <strong>${row.email_provider}</strong>. If you're reading this, your integration works.</p>`,
      text: `This is a test email sent from your CRM using ${row.email_provider}.`,
    });

    // mark verified
    await supabase
      .from("sub_account_integrations")
      .update({ email_verified_at: new Date().toISOString() })
      .eq("sub_account_id", data.sub_account_id);

    return { ok: true as const, id: result.id };
  });

// ============ Test send: sms ============
export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sub_account_id: string;
      to: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("sub_account_integrations")
      .select("*")
      .eq("sub_account_id", data.sub_account_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.sms_provider) throw new Error("No SMS provider configured");
    if (!row.sms_from_number) throw new Error("Missing from number");

    const { sendSmsViaTwilio } = await import("./integrations.server");
    const result = await sendSmsViaTwilio({
      config: row.sms_config as TwilioConfig,
      from: row.sms_from_number,
      to: data.to,
      body: "Test SMS from your CRM. Integration works.",
    });

    await supabase
      .from("sub_account_integrations")
      .update({ sms_verified_at: new Date().toISOString() })
      .eq("sub_account_id", data.sub_account_id);

    return { ok: true as const, id: result.id };
  });

// ============ Interactive send from UI (e.g. Send email button on contact) ============
export const sendEmailNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sub_account_id: string;
      to: string;
      subject: string;
      body_html?: string;
      body_text?: string;
      contact_id?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Queue the row; processor will pick it up. Also try to send immediately.
    const { data: msg, error } = await supabase
      .from("outbound_messages")
      .insert({
        sub_account_id: data.sub_account_id,
        channel: "email",
        to_address: data.to,
        subject: data.subject,
        body_html: data.body_html ?? null,
        body_text: data.body_text ?? null,
        contact_id: data.contact_id ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    // Trigger processor once (best-effort)
    try {
      const { processOne } = await import("./integrations.server-queue");
      await processOne(msg.id);
    } catch {
      // leave queued
    }
    return { ok: true as const, id: msg.id };
  });

// Wrapper for the drain function so client-safe modules never import server-only code
export const drainOutboundQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { drainAll } = await import("./integrations.server-queue");
    return drainAll();
  });

// Retry a single failed outbound message from the UI.
// RLS check: we look the row up as the caller first (so users can only retry
// their own workspace's messages), then use the service-role processor to
// actually resend.
export const retryOutboundMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("outbound_messages")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Message not found or not accessible");

    // Reset failed → queued so processOne will pick it up
    if (row.status === "failed") {
      const { error: uErr } = await supabase
        .from("outbound_messages")
        .update({ status: "queued", next_attempt_at: null, error: null } as never)
        .eq("id", row.id);
      if (uErr) throw new Error(uErr.message);
    }

    const { processOne } = await import("./integrations.server-queue");
    await processOne(row.id);
    return { ok: true as const };
  });

// keep helper referenced so the file compiles cleanly
void assertAdminAccess;
void ({} as SupabaseLike);

