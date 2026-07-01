/**
 * Server-only outbound queue processor. Uses the service role client because
 * cron/worker calls have no user session. Loaded lazily by callers.
 */
import type { SmtpConfig, ResendConfig, SendGridConfig, TwilioConfig } from "./integrations";
import { sendEmailViaProvider, sendSmsViaTwilio } from "./integrations.server";

const MAX_ATTEMPTS = 5;

type Row = {
  id: string;
  sub_account_id: string;
  channel: "email" | "sms";
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attempts: number;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadIntegration(subAccountId: string) {
  const sb = await admin();
  const { data, error } = await sb
    .from("sub_account_integrations")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function processRow(row: Row): Promise<{ ok: boolean; error?: string; providerId?: string }> {
  const cfg = await loadIntegration(row.sub_account_id);
  if (!cfg) return { ok: false, error: "No integration configured" };

  if (row.channel === "email") {
    if (!cfg.email_provider || !cfg.email_from_address) {
      return { ok: false, error: "Email not configured" };
    }
    const r = await sendEmailViaProvider({
      provider: cfg.email_provider as "smtp" | "resend" | "sendgrid",
      config: cfg.email_config as SmtpConfig | ResendConfig | SendGridConfig,
      from: cfg.email_from_address,
      fromName: cfg.email_from_name,
      to: row.to_address,
      subject: row.subject ?? "(no subject)",
      html: row.body_html,
      text: row.body_text,
    });
    return { ok: true, providerId: r.id };
  }

  if (row.channel === "sms") {
    if (!cfg.sms_provider || !cfg.sms_from_number) {
      return { ok: false, error: "SMS not configured" };
    }
    const r = await sendSmsViaTwilio({
      config: cfg.sms_config as TwilioConfig,
      from: cfg.sms_from_number,
      to: row.to_address,
      body: row.body_text ?? "",
    });
    return { ok: true, providerId: r.id };
  }

  return { ok: false, error: `Unknown channel: ${row.channel}` };
}

export async function processOne(id: string): Promise<void> {
  const sb = await admin();
  const { data: row, error } = await sb
    .from("outbound_messages")
    .select("id, sub_account_id, channel, to_address, subject, body_text, body_html, attempts")
    .eq("id", id)
    .eq("status", "queued")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return;

  await sb.from("outbound_messages").update({ status: "sending", attempts: row.attempts + 1 }).eq("id", row.id);

  try {
    const result = await processRow(row as Row);
    if (result.ok) {
      await sb
        .from("outbound_messages")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_message_id: result.providerId ?? null,
          error: null,
        })
        .eq("id", row.id);
    } else {
      const isFinal = row.attempts + 1 >= MAX_ATTEMPTS;
      await sb
        .from("outbound_messages")
        .update({
          status: isFinal ? "failed" : "queued",
          error: result.error ?? "Unknown error",
          next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .eq("id", row.id);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isFinal = row.attempts + 1 >= MAX_ATTEMPTS;
    await sb
      .from("outbound_messages")
      .update({
        status: isFinal ? "failed" : "queued",
        error: msg,
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq("id", row.id);
  }
}

export async function drainAll(): Promise<{ processed: number }> {
  const sb = await admin();
  const { data, error } = await sb
    .from("outbound_messages")
    .select("id")
    .eq("status", "queued")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    await processOne(row.id);
  }
  return { processed: (data ?? []).length };
}
