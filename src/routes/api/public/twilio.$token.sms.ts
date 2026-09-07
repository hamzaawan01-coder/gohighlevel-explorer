// Public webhook — receives inbound SMS/MMS from Twilio.
// Security: per-connection random token in the URL path is the shared secret
// (each workspace gets a unique URL when they connect). We also verify the
// Twilio AccountSid in the payload matches the connection.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/twilio/$token/sms")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        const form = await request.formData();
        const from = String(form.get("From") ?? "");
        const to = String(form.get("To") ?? "");
        const body = String(form.get("Body") ?? "");
        const messageSid = String(form.get("MessageSid") ?? "");
        const accountSid = String(form.get("AccountSid") ?? "");
        const numMedia = Number(form.get("NumMedia") ?? 0);
        const mediaUrls: string[] = [];
        for (let i = 0; i < numMedia; i++) {
          const u = form.get(`MediaUrl${i}`);
          if (u) mediaUrls.push(String(u));
        }

        if (!token || !from || !to || !messageSid) {
          return new Response("Bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // 1. Find the connection by webhook token
        const { data: conn } = await (supabaseAdmin as any)
          .from("twilio_connections")
          .select("id, sub_account_id, account_sid")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!conn) return new Response("Unknown token", { status: 404 });
        if (conn.account_sid !== accountSid) {
          return new Response("Account mismatch", { status: 401 });
        }

        // 2. Find our owned number receiving this
        const { data: numRow } = await (supabaseAdmin as any)
          .from("twilio_numbers")
          .select("id, phone_number")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("phone_number", to)
          .is("released_at", null)
          .maybeSingle();
        if (!numRow) return new Response("Number not owned", { status: 404 });

        // 3. Upsert contact by phone within sub-account
        let contact: { id: string; owner_id: string } | null = null;
        const { data: existingContact } = await (supabaseAdmin as any)
          .from("contacts")
          .select("id, owner_id")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("phone", from)
          .maybeSingle();

        if (existingContact) {
          contact = existingContact;
        } else {
          // Pick any admin/owner as the contact owner
          const { data: ownerRow } = await (supabaseAdmin as any)
            .from("sub_accounts")
            .select("agency_id")
            .eq("id", conn.sub_account_id)
            .single();
          const { data: adminMembership } = await (supabaseAdmin as any)
            .from("agency_memberships")
            .select("user_id")
            .eq("agency_id", ownerRow.agency_id)
            .in("role", ["owner", "admin"])
            .limit(1)
            .single();
          const ownerId = adminMembership?.user_id;
          if (!ownerId) return new Response("No workspace owner", { status: 500 });

          const { data: inserted, error: insertErr } = await (supabaseAdmin as any)
            .from("contacts")
            .insert({
              sub_account_id: conn.sub_account_id,
              owner_id: ownerId,
              phone: from,
              first_name: from,
              lead_source: "sms",
            })
            .select("id, owner_id")
            .single();
          if (insertErr) return new Response(insertErr.message, { status: 500 });
          contact = inserted;
        }
        if (!contact) return new Response("Contact resolve failed", { status: 500 });

        // 4. Get-or-create the SMS conversation for this contact
        const { ensureInboundConversation, notifyInboundMessage } = await import(
          "@/lib/twilio-inbound.server"
        );
        const convo = await ensureInboundConversation(supabaseAdmin as any, {
          subAccountId: conn.sub_account_id,
          contactId: contact.id,
          channel: "sms",
          twilioNumberId: numRow.id,
        });
        if ("error" in convo) return new Response(convo.error, { status: 500 });
        const convoId = convo.id;

        // 5. Insert message (dedup on external_id via unique index)
        const { error: msgErr } = await (supabaseAdmin as any)
          .from("messages")
          .insert({
            conversation_id: convoId,
            sub_account_id: conn.sub_account_id,
            author_user_id: null,
            body,
            channel: "sms",
            direction: "inbound",
            kind: "sms_log",
            external_id: messageSid,
            from_number: from,
            to_number: to,
            sender_handle: from,
            media_urls: mediaUrls,
          });
        // Duplicate delivery is fine — Twilio may retry
        if (msgErr && !String(msgErr.message ?? "").includes("duplicate")) {
          return new Response(msgErr.message, { status: 500 });
        }
        if (!msgErr) {
          await notifyInboundMessage(supabaseAdmin as any, {
            subAccountId: conn.sub_account_id,
            contactId: contact.id,
            channel: "sms",
            senderName: from,
            body,
          });
        }


        // Respond with empty TwiML to acknowledge without auto-reply
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response/>',
          { status: 200, headers: { "Content-Type": "text/xml" } },
        );
      },
    },
  },
});
