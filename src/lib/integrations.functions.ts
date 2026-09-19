import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  SmtpConfig,
  ResendConfig,
  SendGridConfig,
  TwilioConfig,
} from "./integrations";

/**
 * Verify the caller is an owner/admin of the workspace, then return a
 * service-role client. Provider credentials (sms_config / email_config) are not
 * readable by any signed-in role directly — they are only reachable server-side
 * after this check passes.
 */
async function adminClientFor(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  userId: string,
  subAccountId: string,
) {
  const { data, error } = await supabase.rpc("is_subaccount_admin", {
    _user: userId,
    _sub: subAccountId,
  });
  if (error || data !== true) throw new Error("Not authorized for this workspace");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type ConfigRecord = Record<string, unknown>;

function str(v: unknown) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

/**
 * Masked view of the provider configuration for the settings UI.
 * Secrets are never returned — only whether they are set.
 */
export const getIntegrationSafeConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sub_account_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = await adminClientFor(supabase as never, userId, data.sub_account_id);
    const { data: row, error } = await sb
      .from("sub_account_integrations")
      .select("email_config, sms_config")
      .eq("sub_account_id", data.sub_account_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const email = (row?.email_config ?? {}) as ConfigRecord;
    const sms = (row?.sms_config ?? {}) as ConfigRecord;
    return {
      email: {
        host: str(email.host),
        port: Number(email.port ?? 587) || 587,
        secure: Boolean(email.secure),
        user: str(email.user),
        has_password: Boolean(email.password),
        has_api_key: Boolean(email.api_key),
      },
      sms: {
        account_sid: str(sms.account_sid),
        has_auth_token: Boolean(sms.auth_token),
        username: str(sms.username),
        has_api_key: Boolean(sms.api_key),
      },
    };
  });

/** Save email provider settings. Blank secret fields keep the stored value. */
export const saveEmailIntegrationSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sub_account_id: string;
      provider: "smtp" | "resend" | "sendgrid";
      from_address: string;
      from_name?: string | null;
      host?: string;
      port?: number;
      secure?: boolean;
      user?: string;
      password?: string;
      api_key?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = await adminClientFor(supabase as never, userId, data.sub_account_id);
    const { data: existing } = await sb
      .from("sub_account_integrations")
      .select("email_config")
      .eq("sub_account_id", data.sub_account_id)
      .maybeSingle();
    const prev = (existing?.email_config ?? {}) as ConfigRecord;

    let config: ConfigRecord;
    if (data.provider === "smtp") {
      config = {
        host: data.host ?? "",
        port: data.port ?? 587,
        secure: Boolean(data.secure),
        user: data.user ?? "",
        password: data.password ? data.password : str(prev.password),
      };
    } else {
      config = { api_key: data.api_key ? data.api_key : str(prev.api_key) };
    }

    const { error } = await sb.from("sub_account_integrations").upsert(
      {
        sub_account_id: data.sub_account_id,
        email_provider: data.provider,
        email_config: config as never,
        email_from_address: data.from_address,
        email_from_name: data.from_name ?? null,
      },
      { onConflict: "sub_account_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Save SMS provider settings. Blank auth token keeps the stored value. */
export const saveSmsIntegrationSecure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sub_account_id: string;
      provider: "twilio";
      from_number: string;
      account_sid?: string;
      auth_token?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = await adminClientFor(supabase as never, userId, data.sub_account_id);
    const { data: existing } = await sb
      .from("sub_account_integrations")
      .select("sms_config")
      .eq("sub_account_id", data.sub_account_id)
      .maybeSingle();
    const prev = (existing?.sms_config ?? {}) as ConfigRecord;

    const config: ConfigRecord = {
      account_sid: data.account_sid ?? str(prev.account_sid),
      auth_token: data.auth_token ? data.auth_token : str(prev.auth_token),
    };

    const { error } = await sb.from("sub_account_integrations").upsert(
      {
        sub_account_id: data.sub_account_id,
        sms_provider: data.provider,
        sms_config: config as never,
        sms_from_number: data.from_number,
      },
      { onConflict: "sub_account_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

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
    const { supabase, userId } = context;
    const sb = await adminClientFor(supabase as never, userId, data.sub_account_id);
    const { data: row, error } = await sb
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
    await sb
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
    const { supabase, userId } = context;
    const sb = await adminClientFor(supabase as never, userId, data.sub_account_id);
    const { data: row, error } = await sb
      .from("sub_account_integrations")
      .select("*")
      .eq("sub_account_id", data.sub_account_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row.sms_provider) throw new Error("No SMS provider configured");
    if (!row.sms_from_number) {
      throw new Error("Missing from number");
    }

    const { sendSmsViaTwilio } = await import("./integrations.server");
    const body = "Test SMS from your CRM. Integration works.";
    const result = await sendSmsViaTwilio({
      config: row.sms_config as TwilioConfig,
      from: row.sms_from_number!,
      to: data.to,
      body,
    });

    await sb
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
// The row is looked up as the caller first (so users can only retry their own
// workspace's messages); the status reset and resend then run with the
// service-role processor, so the queue table needs no client UPDATE policy.
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reset failed → queued so processOne will pick it up
    if (row.status === "failed") {
      const { error: uErr } = await supabaseAdmin
        .from("outbound_messages")
        .update({ status: "queued", next_attempt_at: null, error: null } as never)
        .eq("id", row.id);
      if (uErr) throw new Error(uErr.message);
    }

    const { processOne } = await import("./integrations.server-queue");
    await processOne(row.id);
    return { ok: true as const };
  });
