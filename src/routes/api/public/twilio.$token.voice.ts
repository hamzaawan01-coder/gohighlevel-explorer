// Inbound voice webhook — Twilio POSTs here when someone calls one of our numbers.
// Returns TwiML that greets, rings the workspace's agents (browser clients),
// and falls back to voicemail on no-answer.
import { createFileRoute } from "@tanstack/react-router";
import { escapeXml } from "@/lib/twilio-voice.server";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export const Route = createFileRoute("/api/public/twilio/$token/voice")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        const form = await request.formData();
        const from = String(form.get("From") ?? "");
        const to = String(form.get("To") ?? "");
        const callSid = String(form.get("CallSid") ?? "");
        const accountSid = String(form.get("AccountSid") ?? "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await (supabaseAdmin as any)
          .from("twilio_connections")
          .select("id, sub_account_id, account_sid, webhook_token")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!conn) return xml("<Say>This number is not configured.</Say><Hangup/>");
        if (conn.account_sid !== accountSid) return new Response("Account mismatch", { status: 401 });

        // Owned number receiving the call
        const { data: numRow } = await (supabaseAdmin as any)
          .from("twilio_numbers")
          .select("id, phone_number, friendly_name")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("phone_number", to)
          .is("released_at", null)
          .maybeSingle();

        // Log the inbound call (best-effort)
        if (numRow) {
          // Upsert contact by phone
          let contactId: string | null = null;
          const { data: existing } = await (supabaseAdmin as any)
            .from("contacts")
            .select("id")
            .eq("sub_account_id", conn.sub_account_id)
            .eq("phone", from)
            .maybeSingle();
          contactId = existing?.id ?? null;

          const inserted = await (supabaseAdmin as any).from("phone_calls").insert({
            sub_account_id: conn.sub_account_id,
            twilio_number_id: numRow.id,
            contact_id: contactId,
            direction: "inbound",
            from_number: from,
            to_number: to,
            call_sid: callSid,
            status: "ringing",
          }).select("id").single();
          // Created exactly once per call → natural dedup for the inbox note.
          if (inserted.data?.id) {
            const { notifyTeam } = await import("@/lib/twilio-inbound.server");
            await notifyTeam(supabaseAdmin as any, {
              subAccountId: conn.sub_account_id,
              title: `Incoming call from ${from}`,
              body: `Ringing your numbers now — answered calls and voicemails land on the Calls page.`,
              link: "/calls",
            });
          }
        }

        // Load call flow for this number (or workspace default)
        const { data: flow } = await (supabaseAdmin as any)
          .from("phone_call_flows")
          .select("greeting_text, voice_language, voice_gender, ring_agent_ids, ring_timeout_seconds, voicemail_enabled, voicemail_prompt, menu")
          .eq("sub_account_id", conn.sub_account_id)
          .or(`twilio_number_id.eq.${numRow?.id ?? "00000000-0000-0000-0000-000000000000"},is_default.eq.true`)
          .order("twilio_number_id", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const language = flow?.voice_language ?? "en-US";
        const voice = flow?.voice_gender ?? "alice";
        const greeting = flow?.greeting_text ?? "Please hold while we connect you.";
        const timeout = flow?.ring_timeout_seconds ?? 20;
        const agentIds: string[] = flow?.ring_agent_ids ?? [];
        const voicemailPrompt = flow?.voicemail_prompt ?? "Please leave a message after the tone.";
        const voicemailEnabled = flow?.voicemail_enabled ?? true;

        // If no configured agents, ring every workspace member as a client
        let ringIds = agentIds;
        if (!ringIds.length) {
          const { data: mems } = await (supabaseAdmin as any)
            .from("sub_account_memberships")
            .select("user_id")
            .eq("sub_account_id", conn.sub_account_id);
          ringIds = (mems ?? []).map((m: any) => m.user_id);
          if (!ringIds.length) {
            const { data: sub } = await (supabaseAdmin as any)
              .from("sub_accounts").select("agency_id").eq("id", conn.sub_account_id).single();
            const { data: agents } = await (supabaseAdmin as any)
              .from("agency_memberships").select("user_id").eq("agency_id", sub.agency_id);
            ringIds = (agents ?? []).map((m: any) => m.user_id);
          }
        }

        const clientTags = ringIds.map((id) => `<Client>agent_${escapeXml(id)}</Client>`).join("");
        const voicemailUrl = `/api/public/twilio/${token}/voicemail`;

        let action = "";
        if (voicemailEnabled) {
          action = ` action="${voicemailUrl}" method="POST"`;
        }

        const twiml =
          `<Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${escapeXml(greeting)}</Say>` +
          (clientTags
            ? `<Dial timeout="${timeout}" callerId="${escapeXml(from)}" record="record-from-answer" recordingStatusCallback="/api/public/twilio/${token}/recording" recordingStatusCallbackMethod="POST"${action}>${clientTags}</Dial>`
            : "") +
          (voicemailEnabled
            ? `<Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">${escapeXml(voicemailPrompt)}</Say>` +
              `<Record maxLength="180" playBeep="true" transcribe="true" transcribeCallback="/api/public/twilio/${token}/voicemail" action="/api/public/twilio/${token}/voicemail" method="POST"/>`
            : `<Say voice="${escapeXml(voice)}" language="${escapeXml(language)}">Goodbye.</Say><Hangup/>`);

        return xml(twiml);
      },
    },
  },
});
