import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { mapPayload, type FieldMap } from "@/lib/wordpress-field-map";

/**
 * Public WordPress webhook receiver.
 * URL:  /api/public/hooks/wordpress/{token}
 *
 * Accepts POST as either JSON or application/x-www-form-urlencoded / multipart/form-data.
 * Optional HMAC verification: header `x-wp-signature: sha256=<hex>` where hex = HMAC_SHA256(raw_body, secret).
 * Field aliases from field_map convert WP field names into standard contact fields.
 * Creates or updates a contact in the workspace and stores the raw payload as a form_submission.
 */

const MAX_BODY = 100_000; // 100KB


function verifySignature(rawBody: string, secret: string, header: string | null): boolean {
  if (!header) return false;
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  let expected: string;
  try {
    expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  } catch {
    return false;
  }
  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function parseBody(request: Request, rawBody: string): Promise<Record<string, unknown> | null> {
  const ct = (request.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const parsed = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        // Some plugins nest under "data" / "fields" / "payload"
        const p = parsed as Record<string, unknown>;
        const nested = (p.data ?? p.fields ?? p.payload) as unknown;
        if (nested && typeof nested === "object" && !Array.isArray(nested)) {
          return { ...(nested as Record<string, unknown>), ...p };
        }
        return p;
      }
      return null;
    }
    if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
      // rebuild a Request so formData() works on the raw text
      const req = new Request("http://x/", {
        method: "POST",
        headers: { "content-type": ct },
        body: rawBody,
      });
      const fd = await req.formData();
      const out: Record<string, unknown> = {};
      fd.forEach((v, k) => {
        out[k] = typeof v === "string" ? v : v.name;
      });
      return out;
    }
    // Best-effort: try JSON
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/hooks/wordpress/$token")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          message: "WordPress webhook endpoint is live. POST form submissions here.",
        }),
      POST: async ({ request, params }) => {
        const token = params.token;
        if (!token || token.length < 20 || token.length > 128) {
          return new Response("Bad token", { status: 400 });
        }

        const rawBody = await request.text();
        if (rawBody.length > MAX_BODY) {
          return new Response("Payload too large", { status: 413 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: hook, error: hErr } = await supabaseAdmin
          .from("wordpress_webhooks")
          .select("id, sub_account_id, form_id, secret, field_map, default_tags, lead_source, enabled")
          .eq("token", token)
          .maybeSingle();

        if (hErr || !hook) return new Response("Webhook not found", { status: 404 });
        if (!hook.enabled) return new Response("Webhook disabled", { status: 403 });

        // Optional HMAC verification
        if (hook.secret) {
          const sig =
            request.headers.get("x-wp-signature") ??
            request.headers.get("x-signature") ??
            request.headers.get("x-hub-signature-256");
          if (!verifySignature(rawBody, hook.secret, sig)) {
            return new Response("Invalid signature", { status: 401 });
          }
        }

        const parsed = await parseBody(request, rawBody);
        if (!parsed) return new Response("Invalid body", { status: 400 });

        // Look up owner via the linked lead_form so the contact has a valid owner_id
        const { data: form, error: fErr } = await supabaseAdmin
          .from("lead_forms")
          .select("id, owner_id, sub_account_id")
          .eq("id", hook.form_id)
          .maybeSingle();
        if (fErr || !form) return new Response("Form missing", { status: 500 });

        const fieldMap = (hook.field_map ?? {}) as FieldMap;
        const { mapped, extras } = mapPayload(parsed, fieldMap);
        const source_url =
          (typeof parsed.source_url === "string" ? parsed.source_url : null) ??
          (typeof parsed.page_url === "string" ? parsed.page_url : null) ??
          request.headers.get("referer");

        let contactId: string | null = null;
        if (mapped.email) {
          const { data: existing } = await supabaseAdmin
            .from("contacts")
            .select("id, tags")
            .eq("sub_account_id", hook.sub_account_id)
            .eq("email", mapped.email)
            .maybeSingle();

          const contactCols: Record<string, unknown> = {};
          if (mapped.first_name) contactCols.first_name = mapped.first_name;
          if (mapped.last_name) contactCols.last_name = mapped.last_name;
          if (mapped.phone) contactCols.phone = mapped.phone;
          if (mapped.company) contactCols.company = mapped.company;
          if (mapped.notes) contactCols.notes = mapped.notes;

          if (existing?.id) {
            contactId = existing.id;
            // merge tags
            const existingTags = new Set<string>((existing.tags as string[] | null) ?? []);
            for (const t of hook.default_tags ?? []) existingTags.add(t);
            contactCols.tags = Array.from(existingTags);
            await supabaseAdmin.from("contacts").update(contactCols as never).eq("id", existing.id);
          } else {
            const { data: created, error: cErr } = await supabaseAdmin
              .from("contacts")
              .insert({
                ...contactCols,
                email: mapped.email,
                sub_account_id: hook.sub_account_id,
                owner_id: form.owner_id,
                lifecycle_stage: "lead",
                lead_source: hook.lead_source || "WordPress",
                tags: hook.default_tags ?? [],
              })
              .select("id")
              .single();
            if (cErr) return new Response("Could not create contact", { status: 500 });
            contactId = created.id;
          }
        }

        const payloadOut: Record<string, unknown> = { ...mapped, ...extras };
        const { error: sErr } = await supabaseAdmin.from("form_submissions").insert({
          form_id: hook.form_id,
          sub_account_id: hook.sub_account_id,
          contact_id: contactId,
          payload: payloadOut as never,
          source_url: typeof source_url === "string" ? source_url.slice(0, 500) : null,
        });
        if (sErr) return new Response("Could not save submission", { status: 500 });

        await supabaseAdmin
          .from("wordpress_webhooks")
          .update({
            last_received_at: new Date().toISOString(),
            last_error: null,
          } as never)
          .eq("id", hook.id);

        return Response.json({ ok: true, contact_id: contactId });
      },
    },
  },
});
