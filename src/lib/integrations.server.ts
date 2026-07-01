/**
 * Server-only send helpers. Dispatches to the tenant's configured provider.
 * Never import this file from route/component code — always via a server function.
 */
import type { SmtpConfig, ResendConfig, SendGridConfig, TwilioConfig } from "./integrations";

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
