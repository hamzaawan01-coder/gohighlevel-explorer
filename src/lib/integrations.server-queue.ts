/**
 * Server-only outbound queue processor. Uses the service role client because
 * cron/worker calls have no user session. Loaded lazily by callers.
 *
 * Design goals:
 *  - Every send attempt writes one row to `outbound_message_logs` with the
 *    provider, error, error code, retryable flag and latency — so failures
 *    are diagnosable per message instead of showing as a generic 500.
 *  - Retries use capped exponential backoff (1m, 2m, 4m, 8m, 16m, max 30m)
 *    plus small jitter, so a bad provider config doesn't hammer the API.
 *  - Errors are classified: auth / config / validation errors are permanent
 *    and fail immediately; network / 5xx / 429 are retried until MAX_ATTEMPTS.
 *  - drainAll never throws — a bad row is logged and skipped so one message
 *    can't take the whole cron run down (no more 500 storm on /process-outbound).
 */
import type { SmtpConfig, ResendConfig, SendGridConfig, TwilioConfig } from "./integrations";
import { sendEmailViaProvider, sendSmsViaTwilio, sendSmsViaTwilioGateway } from "./integrations.server";

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60_000; // 1 minute
const MAX_BACKOFF_MS = 30 * 60_000; // 30 minutes

type Row = {
  id: string;
  sub_account_id: string;
  channel: "email" | "sms";
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attempts: number;
  provider?: string | null;
};

type SendOutcome = {
  ok: boolean;
  provider: string | null;
  providerId?: string | null;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  latencyMs: number;
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

/** Classify an error thrown by a provider send into a retryable flag + code. */
function classifyError(err: unknown): { message: string; code: string; retryable: boolean } {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();

  // HTTP status hints embedded in provider error strings ("Resend 429: ...")
  const statusMatch = raw.match(/\b(4\d\d|5\d\d)\b/);
  const status = statusMatch ? Number(statusMatch[1]) : null;

  if (status === 401 || status === 403 || /unauthori[sz]ed|forbidden|invalid api key|authentication/i.test(raw)) {
    return { message: raw, code: `http_${status ?? "auth"}`, retryable: false };
  }
  if (status === 400 || status === 422 || /invalid|malformed|missing|bad request/i.test(raw)) {
    return { message: raw, code: `http_${status ?? "validation"}`, retryable: false };
  }
  if (status === 404) {
    return { message: raw, code: "http_404", retryable: false };
  }
  if (status === 429 || /rate limit|too many requests/i.test(raw)) {
    return { message: raw, code: "http_429", retryable: true };
  }
  if (status && status >= 500) {
    return { message: raw, code: `http_${status}`, retryable: true };
  }
  if (/network|timeout|fetch failed|econnreset|enotfound|socket/i.test(msg)) {
    return { message: raw, code: "network", retryable: true };
  }
  if (/smtp is not supported/i.test(raw)) {
    return { message: raw, code: "provider_unsupported", retryable: false };
  }
  if (/not configured|no integration|missing from/i.test(raw)) {
    return { message: raw, code: "not_configured", retryable: false };
  }
  // Default: retry a few times, then give up.
  return { message: raw, code: "unknown", retryable: true };
}

function backoffMs(attempts: number): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS);
  const jitter = Math.floor(Math.random() * 5_000);
  return base + jitter;
}

async function attemptSend(row: Row): Promise<SendOutcome> {
  const start = Date.now();
  const cfg = await loadIntegration(row.sub_account_id);
  if (!cfg) {
    return {
      ok: false,
      provider: null,
      error: "No integration configured for this workspace",
      errorCode: "not_configured",
      retryable: false,
      latencyMs: Date.now() - start,
    };
  }

  try {
    if (row.channel === "email") {
      if (!cfg.email_provider || !cfg.email_from_address) {
        return {
          ok: false,
          provider: cfg.email_provider ?? null,
          error: "Email provider or from-address is not configured",
          errorCode: "not_configured",
          retryable: false,
          latencyMs: Date.now() - start,
        };
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
      return {
        ok: true,
        provider: cfg.email_provider,
        providerId: r.id,
        latencyMs: Date.now() - start,
      };
    }

    if (row.channel === "sms") {
      if (!cfg.sms_provider || !cfg.sms_from_number) {
        return {
          ok: false,
          provider: cfg.sms_provider ?? null,
          error: "SMS provider or from-number is not configured",
          errorCode: "not_configured",
          retryable: false,
          latencyMs: Date.now() - start,
        };
      }
      const { sendSmsViaTextMagic } = await import("./integrations.server");
      const r =
        cfg.sms_provider === "twilio_connector"
          ? await sendSmsViaTwilioGateway({
              from: cfg.sms_from_number,
              to: row.to_address,
              body: row.body_text ?? "",
            })
          : cfg.sms_provider === "textmagic"
            ? await sendSmsViaTextMagic({
                config: cfg.sms_config as TextMagicConfig,
                from: cfg.sms_from_number,
                to: row.to_address,
                body: row.body_text ?? "",
              })
            : await sendSmsViaTwilio({
                config: cfg.sms_config as TwilioConfig,
                from: cfg.sms_from_number,
                to: row.to_address,
                body: row.body_text ?? "",
              });
      return {
        ok: true,
        provider: cfg.sms_provider,
        providerId: r.id,
        latencyMs: Date.now() - start,
      };
    }

    return {
      ok: false,
      provider: null,
      error: `Unknown channel: ${row.channel}`,
      errorCode: "unknown_channel",
      retryable: false,
      latencyMs: Date.now() - start,
    };
  } catch (e) {
    const c = classifyError(e);
    return {
      ok: false,
      provider: (row.channel === "email" ? cfg.email_provider : cfg.sms_provider) ?? null,
      error: c.message,
      errorCode: c.code,
      retryable: c.retryable,
      latencyMs: Date.now() - start,
    };
  }
}

async function writeLog(row: Row, attempt: number, outcome: SendOutcome) {
  const sb = await admin();
  await sb.from("outbound_message_logs" as never).insert({
    message_id: row.id,
    sub_account_id: row.sub_account_id,
    attempt,
    status: outcome.ok ? "sent" : "failed",
    provider: outcome.provider,
    provider_message_id: outcome.providerId ?? null,
    error: outcome.error ?? null,
    error_code: outcome.errorCode ?? null,
    retryable: outcome.retryable ?? null,
    latency_ms: outcome.latencyMs,
  } as never);
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

  const nextAttempt = (row.attempts ?? 0) + 1;
  await sb
    .from("outbound_messages")
    .update({ status: "sending", attempts: nextAttempt })
    .eq("id", row.id);

  const outcome = await attemptSend(row as Row);

  // Fire-and-forget the log write; a log failure shouldn't fail the message.
  try {
    await writeLog(row as Row, nextAttempt, outcome);
  } catch {
    /* ignore */
  }

  if (outcome.ok) {
    await sb
      .from("outbound_messages")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider: outcome.provider,
        provider_message_id: outcome.providerId ?? null,
        error: null,
        next_attempt_at: null,
      } as never)
      .eq("id", row.id);
    return;
  }

  const permanent = outcome.retryable === false;
  const outOfAttempts = nextAttempt >= MAX_ATTEMPTS;
  const finalFailure = permanent || outOfAttempts;

  await sb
    .from("outbound_messages")
    .update({
      status: finalFailure ? "failed" : "queued",
      provider: outcome.provider,
      error: outcome.error ?? "Unknown error",
      next_attempt_at: finalFailure
        ? null
        : new Date(Date.now() + backoffMs(nextAttempt)).toISOString(),
    } as never)
    .eq("id", row.id);

}

export async function drainAll(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  requeued: number;
  errors: { id: string; error: string }[];
}> {
  const sb = await admin();
  const nowIso = new Date().toISOString();
  const { data, error } = await sb
    .from("outbound_messages")
    .select("id")
    .eq("status", "queued")
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(25);
  if (error) throw new Error(error.message);

  const errors: { id: string; error: string }[] = [];
  let sent = 0;
  let failed = 0;
  let requeued = 0;

  for (const r of data ?? []) {
    try {
      await processOne(r.id);
      // Re-read to bucket the outcome for the cron response.
      const { data: after } = await sb
        .from("outbound_messages")
        .select("status")
        .eq("id", r.id)
        .maybeSingle();
      if (after?.status === "sent") sent++;
      else if (after?.status === "failed") failed++;
      else requeued++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ id: r.id, error: msg });
    }
  }

  return { processed: (data ?? []).length, sent, failed, requeued, errors };
}
