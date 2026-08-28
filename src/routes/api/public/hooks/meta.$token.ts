/**
 * Single Meta webhook endpoint for Messenger, Instagram Direct, and Lead Ads.
 *
 * URL: /api/public/hooks/meta/{connection_id}
 * - GET  : responds to Meta's subscription challenge if hub.verify_token matches
 *         process.env.META_WEBHOOK_VERIFY_TOKEN.
 * - POST : verifies X-Hub-Signature-256 (HMAC-SHA256 of raw body with META_APP_SECRET),
 *         then dispatches by object type.
 *
 * The {token} in the URL is the meta_connections.id — used to scope inbound
 * events to the right workspace when multiple accounts share our app.
 */
import { createFileRoute } from "@tanstack/react-router";
import { verifyMetaSignature, fetchLeadById, createOpportunityForLead } from "@/lib/meta.server";

type MessagingEntry = {
  id: string; // page id
  time?: number;
  messaging?: Array<{
    sender: { id: string };
    recipient: { id: string };
    timestamp?: number;
    message?: { mid: string; text?: string };
  }>;
  changes?: Array<{
    field: string;
    value: {
      leadgen_id?: string;
      page_id?: string;
      form_id?: string;
      created_time?: number;
      ad_id?: string;
    };
  }>;
};

type WebhookPayload = {
  object: "page" | "instagram" | string;
  entry?: MessagingEntry[];
};

export const Route = createFileRoute("/api/public/hooks/meta/$token")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
        if (mode === "subscribe" && token && expected && token === expected && challenge) {
          return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request, params }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-hub-signature-256");
        if (!verifyMetaSignature(raw, sig)) return new Response("Invalid signature", { status: 401 });

        const connectionId = params.token;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: connRows } = await (supabaseAdmin as any)
          .from("meta_connections").select("*").eq("id", connectionId).limit(1);
        const conn = (connRows ?? [])[0] as { id: string; sub_account_id: string; created_by: string } | undefined;
        if (!conn) {
          // Always ack 200 so Meta doesn't retry — the connection was removed.
          return new Response("ok", { status: 200 });
        }

        let payload: WebhookPayload;
        try { payload = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

        for (const entry of payload.entry ?? []) {
          // Messenger / IG DM
          for (const m of entry.messaging ?? []) {
            if (!m.message?.text) continue;
            const channel: "messenger" | "instagram" = payload.object === "instagram" ? "instagram" : "messenger";
            const pageId = entry.id;
            const senderId = m.sender.id;

            const { data: pageRows } = await (supabaseAdmin as any)
              .from("meta_pages").select("*")
              .eq("sub_account_id", conn.sub_account_id).eq("page_id", pageId).limit(1);
            const page = (pageRows ?? [])[0] as { id: string; route_messenger_to_inbox: boolean; route_instagram_to_inbox: boolean } | undefined;
            if (!page) continue;
            if (channel === "messenger" && !page.route_messenger_to_inbox) continue;
            if (channel === "instagram" && !page.route_instagram_to_inbox) continue;

            const externalKey = `${channel}:${pageId}:${senderId}`;
            // Upsert conversation
            const { data: convRows } = await (supabaseAdmin as any)
              .from("conversations").select("id")
              .eq("sub_account_id", conn.sub_account_id).eq("external_thread_id", externalKey).limit(1);
            let convId = (convRows ?? [])[0]?.id as string | undefined;
            if (!convId) {
              const { data: newConv, error: convErr } = await (supabaseAdmin as any)
                .from("conversations")
                .insert({
                  sub_account_id: conn.sub_account_id,
                  channel,
                  external_thread_id: externalKey,
                  last_message_at: new Date((m.timestamp ?? Date.now())).toISOString(),
                })
                .select("id").single();
              if (convErr) continue;
              convId = newConv.id as string;
            }

            await (supabaseAdmin as any).from("messages").insert({
              conversation_id: convId,
              sub_account_id: conn.sub_account_id,
              direction: "inbound",
              channel,
              kind: channel === "instagram" ? "instagram_log" : "messenger_log",
              body: m.message.text,
              external_id: m.message.mid,
              sender_handle: senderId,
            });
          }

          // Lead Ads
          for (const ch of entry.changes ?? []) {
            if (ch.field !== "leadgen" || !ch.value.leadgen_id) continue;
            const pageId = ch.value.page_id ?? entry.id;
            const { data: pageRows } = await (supabaseAdmin as any)
              .from("meta_pages").select("*")
              .eq("sub_account_id", conn.sub_account_id).eq("page_id", pageId).limit(1);
            const page = (pageRows ?? [])[0] as { page_access_token: string; sync_lead_ads: boolean } | undefined;
            if (!page || !page.sync_lead_ads) continue;

            try {
              const lead = await fetchLeadById(ch.value.leadgen_id, page.page_access_token);
              const fields = Object.fromEntries(lead.field_data.map((f) => [f.name.toLowerCase(), f.values[0] ?? ""]));
              const email = fields["email"] ?? null;
              const phone = fields["phone_number"] ?? fields["phone"] ?? null;
              const first = fields["first_name"] ?? (fields["full_name"] ? String(fields["full_name"]).split(" ")[0] : null);
              const last = fields["last_name"] ?? (fields["full_name"] ? String(fields["full_name"]).split(" ").slice(1).join(" ") : null);

              // Manual upsert: the (sub_account_id, meta_lead_id) unique index is
              // partial, so PostgREST on_conflict cannot be used here.
              const { data: existingRows } = await (supabaseAdmin as any)
                .from("contacts").select("id")
                .eq("sub_account_id", conn.sub_account_id).eq("meta_lead_id", lead.id).limit(1);
              let contactId = (existingRows ?? [])[0]?.id as string | undefined;

              const patch = {
                first_name: first,
                last_name: last,
                email,
                phone,
                lead_source: "meta_lead_ads",
                lifecycle_stage: "lead",
              };

              if (contactId) {
                await (supabaseAdmin as any).from("contacts").update(patch).eq("id", contactId);
              } else {
                const { data: created, error: cErr } = await (supabaseAdmin as any)
                  .from("contacts")
                  .insert({
                    ...patch,
                    sub_account_id: conn.sub_account_id,
                    owner_id: conn.created_by,
                    meta_lead_id: lead.id,
                    tags: [],
                  })
                  .select("id")
                  .single();
                if (cErr) {
                  console.error("meta leadgen contact insert failed", cErr);
                  continue;
                }
                contactId = created.id as string;
              }

              const name = [first, last].filter(Boolean).join(" ").trim();
              await createOpportunityForLead(supabaseAdmin as any, {
                subAccountId: conn.sub_account_id,
                contactId: contactId ?? null,
                title: name || email || phone || "Facebook lead",
                source: "Facebook Lead Ad",
                formId: lead.form_id ?? ch.value.form_id ?? null,
              });
            } catch (e) {
              console.error("meta leadgen fetch failed", e);
            }


          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
