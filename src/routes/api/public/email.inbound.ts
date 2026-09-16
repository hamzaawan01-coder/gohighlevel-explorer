/**
 * Automatic inbound mail drop-off.
 *
 * An inbound mail service (Mailgun Routes, CloudMailin, Postmark inbound, ...)
 * posts every message it receives for the CRM's receiving subdomain here. The
 * recipient address identifies the mailbox: each mailbox gets a private alias
 * of the form <token>@<receiving subdomain>, so clients only ever hand their
 * mail host a normal-looking email address.
 *
 * Every request must prove it came from the configured service:
 *  - Mailgun: HMAC of timestamp+token with MAILGUN_SIGNING_KEY.
 *  - Anything else: the shared value in INBOUND_MAIL_SECRET, sent either as the
 *    x-inbound-secret header, HTTP basic auth password, or ?secret= query.
 * With neither secret configured the endpoint refuses everything, so it can
 * never be used as an open mail injector.
 */
import { createFileRoute } from "@tanstack/react-router";

function pick(source: Record<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const found = Object.keys(source).find((k) => k.toLowerCase() === key.toLowerCase());
    if (found && source[found]) return source[found];
  }
  return "";
}

async function readBody(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? "";
  const flat: Record<string, string> = {};
  if (type.includes("application/json")) {
    const raw = (await request.json()) as Record<string, unknown>;
    for (const [key, value] of Object.entries(raw ?? {})) {
      flat[key] = typeof value === "string" ? value : JSON.stringify(value ?? "");
    }
    return flat;
  }
  const form = await request.formData();
  for (const [key, value] of form.entries()) {
    flat[key] = typeof value === "string" ? value : value.name;
  }
  return flat;
}

async function hmacHex(key: string, message: string) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function basicAuthPassword(header: string | null): string | null {
  if (!header?.toLowerCase().startsWith("basic ")) return null;
  try {
    return atob(header.slice(6)).split(":").slice(1).join(":");
  } catch {
    return null;
  }
}

/** The mailbox alias is the local part of the recipient, tags stripped. */
function tokenFromRecipient(value: string) {
  const match = /([^\s<,;]+)@/.exec(value ?? "");
  const local = (match?.[1] ?? "").trim().toLowerCase();
  return local.split("+")[0] ?? "";
}

export const Route = createFileRoute("/api/public/email/inbound")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const mailgunKey = process.env["MAILGUN_SIGNING_KEY"];
        const sharedSecret = process.env["INBOUND_MAIL_SECRET"];
        if (!mailgunKey && !sharedSecret) {
          return new Response("Inbound mail is not configured", { status: 503 });
        }

        let body: Record<string, string>;
        try {
          body = await readBody(request);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        let authorized = false;
        if (mailgunKey) {
          const timestamp = pick(body, "timestamp");
          const token = pick(body, "token");
          const signature = pick(body, "signature");
          if (timestamp && token && signature) {
            const expected = await hmacHex(mailgunKey, `${timestamp}${token}`);
            authorized = safeEqual(expected, signature.toLowerCase());
          }
        }
        if (!authorized && sharedSecret) {
          const presented =
            request.headers.get("x-inbound-secret") ??
            basicAuthPassword(request.headers.get("authorization")) ??
            url.searchParams.get("secret") ??
            "";
          authorized = !!presented && safeEqual(presented, sharedSecret);
        }
        if (!authorized) return new Response("Invalid signature", { status: 401 });

        const recipient = pick(body, "recipient", "to", "To", "envelope_to", "original-recipient");
        const token = tokenFromRecipient(recipient);
        if (!/^[a-zA-Z0-9]{16,64}$/.test(token)) {
          return new Response("Unknown recipient", { status: 404 });
        }

        const { getMailboxByToken, storeInboundMail } = await import(
          "@/lib/mailbox-forwarding.server"
        );
        const mailbox = await getMailboxByToken(token);
        if (!mailbox || !mailbox.active) {
          return new Response("Unknown recipient", { status: 404 });
        }

        const from = pick(body, "from", "sender", "From", "envelope_from");
        const subject = pick(body, "subject", "Subject");
        const text = pick(body, "text", "body-plain", "plain", "TextBody", "body", "stripped-text");
        const html = pick(body, "html", "body-html", "HtmlBody", "stripped-html");
        if (!from && !subject && !text && !html) {
          return new Response("Nothing to store", { status: 400 });
        }

        try {
          await storeInboundMail(mailbox, {
            from,
            to: mailbox.address,
            cc: pick(body, "cc", "Cc") || null,
            subject,
            text: text || null,
            html: html || null,
            messageId: pick(body, "message-id", "messageId", "Message-Id", "MessageID") || null,
            inReplyTo: pick(body, "in-reply-to", "inReplyTo", "In-Reply-To") || null,
            receivedAt: null,
          });
        } catch (error) {
          console.error("automatic inbound mail failed", error);
          return new Response("Could not store message", { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      GET: async () => new Response("Method not allowed", { status: 405 }),
    },
  },
});
