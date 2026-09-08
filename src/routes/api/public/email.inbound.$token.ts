/**
 * Inbound email drop-off for forwarded mailboxes.
 *
 * Any mail host or inbound-parse service can POST a message here. The token in
 * the URL is the only credential and maps to exactly one mailbox, so an
 * unknown or disabled token is refused. Accepts JSON, form-encoded and
 * multipart bodies, and understands the field names used by the common
 * inbound-parse services.
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
  if (type.includes("application/json")) {
    const raw = (await request.json()) as Record<string, unknown>;
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
      flat[key] = typeof value === "string" ? value : JSON.stringify(value ?? "");
    }
    return flat;
  }
  const form = await request.formData();
  const flat: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") flat[key] = value;
    else flat[key] = value.name;
  }
  return flat;
}

export const Route = createFileRoute("/api/public/email/inbound/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = (params.token ?? "").trim();
        if (!/^[a-zA-Z0-9]{16,64}$/.test(token)) {
          return new Response("Not found", { status: 404 });
        }

        const { getMailboxByToken, storeInboundMail } = await import(
          "@/lib/mailbox-forwarding.server"
        );
        const mailbox = await getMailboxByToken(token);
        if (!mailbox || !mailbox.active) {
          return new Response("Not found", { status: 404 });
        }

        let body: Record<string, string>;
        try {
          body = await readBody(request);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const from = pick(body, "from", "sender", "From", "envelope_from");
        const subject = pick(body, "subject", "Subject");
        const text = pick(body, "text", "body-plain", "plain", "TextBody", "body");
        const html = pick(body, "html", "body-html", "HtmlBody");
        if (!from && !subject && !text && !html) {
          return new Response("Nothing to store", { status: 400 });
        }

        try {
          await storeInboundMail(mailbox, {
            from,
            to: pick(body, "to", "recipient", "To") || mailbox.address,
            cc: pick(body, "cc", "Cc") || null,
            subject,
            text: text || null,
            html: html || null,
            messageId: pick(body, "message-id", "messageId", "Message-Id", "MessageID") || null,
            inReplyTo: pick(body, "in-reply-to", "inReplyTo", "In-Reply-To") || null,
            receivedAt: null,
          });
        } catch (error) {
          console.error("inbound forwarded mail failed", error);
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
