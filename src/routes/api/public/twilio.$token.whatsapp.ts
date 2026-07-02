// Public webhook — inbound WhatsApp messages from Twilio.
// Twilio sends the same shape as SMS but with From/To prefixed by "whatsapp:".
import { createFileRoute } from "@tanstack/react-router";

const strip = (n: string) => n.replace(/^whatsapp:/, "");

export const Route = createFileRoute("/api/public/twilio/$token/whatsapp")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        const form = await request.formData();
        const rawFrom = String(form.get("From") ?? "");
        const rawTo = String(form.get("To") ?? "");
        const from = strip(rawFrom);
        const to = strip(rawTo);
        const body = String(form.get("Body") ?? "");
        const messageSid = String(form.get("MessageSid") ?? "");
        const accountSid = String(form.get("AccountSid") ?? "");
        const profileName = String(form.get("ProfileName") ?? "").trim();
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

        const { data: conn } = await (supabaseAdmin as any)
          .from("twilio_connections")
          .select("id, sub_account_id, account_sid")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!conn) return new Response("Unknown token", { status: 404 });
        if (conn.account_sid !== accountSid) {
          return new Response("Account mismatch", { status: 401 });
        }

        // Match by phone number OR whatsapp_sender field (some senders differ)
        const { data: numRow } = await (supabaseAdmin as any)
          .from("twilio_numbers")
          .select("id, phone_number, whatsapp_enabled")
          .eq("sub_account_id", conn.sub_account_id)
          .or(`phone_number.eq.${to},whatsapp_sender.eq.${to}`)
          .is("released_at", null)
          .maybeSingle();
        if (!numRow) return new Response("Number not owned", { status: 404 });

        // Upsert contact by phone
        let contact: { id: string } | null = null;
        const { data: existingContact } = await (supabaseAdmin as any)
          .from("contacts")
          .select("id")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("phone", from)
          .maybeSingle();

        if (existingContact) {
          contact = existingContact;
        } else {
          const { data: subRow } = await (supabaseAdmin as any)
            .from("sub_accounts")
            .select("agency_id")
            .eq("id", conn.sub_account_id)
            .single();
          const { data: adminMembership } = await (supabaseAdmin as any)
            .from("agency_memberships")
            .select("user_id")
            .eq("agency_id", subRow.agency_id)
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
              first_name: profileName || from,
              lead_source: "whatsapp",
            })
            .select("id")
            .single();
          if (insertErr) return new Response(insertErr.message, { status: 500 });
          contact = inserted;
        }
        if (!contact) return new Response("Contact resolve failed", { status: 500 });

        // Get-or-create conversation
        let convoId: string;
        const { data: existingConvo } = await (supabaseAdmin as any)
          .from("conversations")
          .select("id")
          .eq("contact_id", contact.id)
          .maybeSingle();
        if (existingConvo) {
          convoId = existingConvo.id;
          await (supabaseAdmin as any)
            .from("conversations")
            .update({ channel: "whatsapp", twilio_number_id: numRow.id })
            .eq("id", convoId);
        } else {
          const { data: newConvo, error: convoErr } = await (supabaseAdmin as any)
            .from("conversations")
            .insert({
              sub_account_id: conn.sub_account_id,
              contact_id: contact.id,
              channel: "whatsapp",
              twilio_number_id: numRow.id,
            })
            .select("id")
            .single();
          if (convoErr) return new Response(convoErr.message, { status: 500 });
          convoId = newConvo.id;
        }

        const { error: msgErr } = await (supabaseAdmin as any)
          .from("messages")
          .insert({
            conversation_id: convoId,
            sub_account_id: conn.sub_account_id,
            author_user_id: null,
            body,
            channel: "whatsapp",
            direction: "inbound",
            kind: "whatsapp_log",
            external_id: messageSid,
            from_number: from,
            to_number: to,
            sender_handle: profileName || from,
            media_urls: mediaUrls,
          });
        if (msgErr && !String(msgErr.message ?? "").includes("duplicate")) {
          return new Response(msgErr.message, { status: 500 });
        }

        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response/>',
          { status: 200, headers: { "Content-Type": "text/xml" } },
        );
      },
    },
  },
});
