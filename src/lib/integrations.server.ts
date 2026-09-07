/**
 * Server-only send helpers. Dispatches to the tenant's configured provider.
 * Never import this file from route/component code — always via a server function.
 */
import type {
  SmtpConfig,
  ResendConfig,
  SendGridConfig,
  TwilioConfig,
  TextMagicConfig,
} from "./integrations";

export type SendEmailArgs = {
  provider: "smtp" | "resend" | "sendgrid";
  config: SmtpConfig | ResendConfig | SendGridConfig;
  from: string;
  fromName?: string | null;
  to: string;
  subject: string;
  html?: string | null;
  text?: string | null;
};

export async function sendEmailViaProvider(args: SendEmailArgs): Promise<{ id: string }> {
  const fromLine = args.fromName ? `${args.fromName} <${args.from}>` : args.from;

  if (args.provider === "smtp") {
    // SMTP (nodemailer) requires a Node.js runtime and does not run on the
    // Cloudflare Workers server. Ask the user to switch this workspace to
    // Resend or SendGrid, both of which use plain HTTPS and work everywhere.
    throw new Error(
      "SMTP is not supported on this deployment. Switch this workspace's email provider to Resend or SendGrid in Settings → Integrations.",
    );
  }

  if (args.provider === "resend") {
    const cfg = args.config as ResendConfig;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({
        from: fromLine,
        to: [args.to],
        subject: args.subject,
        html: args.html ?? undefined,
        text: args.text ?? undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(body)}`);
    return { id: (body as { id?: string }).id ?? "resend" };
  }

  if (args.provider === "sendgrid") {
    const cfg = args.config as SendGridConfig;
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from: { email: args.from, name: args.fromName ?? undefined },
        subject: args.subject,
        content: [
          args.text ? { type: "text/plain", value: args.text } : undefined,
          args.html ? { type: "text/html", value: args.html } : undefined,
        ].filter(Boolean),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SendGrid ${res.status}: ${body}`);
    }
    return { id: res.headers.get("x-message-id") ?? "sendgrid" };
  }

  throw new Error(`Unknown email provider: ${String(args.provider)}`);
}

export type SendSmsArgs = {
  config: TwilioConfig;
  from: string;
  to: string;
  body: string;
};

export async function sendSmsViaTwilio(args: SendSmsArgs): Promise<{ id: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${args.config.account_sid}/Messages.json`;
  const auth = btoa(`${args.config.account_sid}:${args.config.auth_token}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: args.to, From: args.from, Body: args.body }),
  });
  const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${body.message ?? JSON.stringify(body)}`);
  return { id: body.sid ?? "twilio" };
}

/**
 * Send an SMS through the workspace-linked Twilio connector via the Lovable
 * gateway. No per-tenant credentials required — auth flows through
 * LOVABLE_API_KEY + TWILIO_API_KEY set by the connector.
 */
export async function sendSmsViaTwilioGateway(args: {
  from: string;
  to: string;
  body: string;
}): Promise<{ id: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  if (!twilioKey) throw new Error("Twilio connector is not linked to this project");

  const res = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: args.to, From: args.from, Body: args.body }),
  });
  const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(`Twilio gateway ${res.status}: ${body.message ?? JSON.stringify(body)}`);
  return { id: body.sid ?? "twilio" };
}

/**
 * Send an SMS through TextMagic's REST API (v2).
 * Auth is HTTP basic-style headers: X-TM-Username + X-TM-Key.
 */
export async function sendSmsViaTextMagic(args: {
  config: TextMagicConfig;
  from: string;
  to: string;
  body: string;
}): Promise<{ id: string }> {
  // Per-workspace credentials win; otherwise fall back to the project-wide
  // TextMagic account so a single agency key can serve every workspace.
  const username = args.config?.username || process.env['TEXTMAGIC_USERNAME'] || "";
  const apiKey = args.config?.api_key || process.env['TEXTMAGIC_API_KEY'] || "";
  if (!username || !apiKey) {
    throw new Error("TextMagic username or API key is not configured");
  }

  const params = new URLSearchParams({
    text: args.body,
    phones: args.to.replace(/\s+/g, ""),
  });
  // A sender id is optional in TextMagic; only send it when present.
  if (args.from) params.set("from", args.from.replace(/\s+/g, ""));

  const res = await fetch("https://rest.textmagic.com/api/v2/messages", {
    method: "POST",
    headers: {
      "X-TM-Username": args.config.username,
      "X-TM-Key": args.config.api_key,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as {
    id?: number;
    message?: string;
    errors?: unknown;
  };
  if (!res.ok) {
    throw new Error(
      `TextMagic ${res.status}: ${body.message ?? JSON.stringify(body.errors ?? body)}`,
    );
  }
  return { id: body.id ? String(body.id) : "textmagic" };
}
