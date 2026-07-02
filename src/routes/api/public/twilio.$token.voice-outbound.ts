// Outbound voice — TwiML app points here. Browser dialer passes To/FromNumberId params.
// We render TwiML that dials the destination using the workspace's Twilio number.
import { createFileRoute } from "@tanstack/react-router";
import { escapeXml } from "@/lib/twilio-voice.server";

function xml(body: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export const Route = createFileRoute("/api/public/twilio/$token/voice-outbound")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        const form = await request.formData();
        const to = String(form.get("To") ?? "");
        const fromNumberId = String(form.get("FromNumberId") ?? "");
        const callerIdentity = String(form.get("From") ?? ""); // client:agent_xxx
        const callSid = String(form.get("CallSid") ?? "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await (supabaseAdmin as any)
          .from("twilio_connections")
          .select("id, sub_account_id")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!conn) return xml("<Say>Unknown workspace.</Say><Hangup/>");

        const { data: num } = await (supabaseAdmin as any)
          .from("twilio_numbers")
          .select("id, phone_number, sub_account_id")
          .eq("id", fromNumberId)
          .maybeSingle();
        if (!num || num.sub_account_id !== conn.sub_account_id) {
          return xml("<Say>Invalid caller ID.</Say><Hangup/>");
        }

        // agent user id from identity
        const agentUserId = callerIdentity.startsWith("client:agent_")
          ? callerIdentity.replace("client:agent_", "")
          : callerIdentity.startsWith("agent_")
            ? callerIdentity.replace("agent_", "")
            : null;

        // Contact lookup
        let contactId: string | null = null;
        const { data: contact } = await (supabaseAdmin as any)
          .from("contacts")
          .select("id")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("phone", to)
          .maybeSingle();
        contactId = contact?.id ?? null;

        await (supabaseAdmin as any).from("phone_calls").insert({
          sub_account_id: conn.sub_account_id,
          twilio_number_id: num.id,
          contact_id: contactId,
          agent_user_id: agentUserId,
          direction: "outbound",
          from_number: num.phone_number,
          to_number: to,
          call_sid: callSid,
          status: "initiated",
        });

        const twiml =
          `<Dial callerId="${escapeXml(num.phone_number)}" record="record-from-answer" ` +
          `recordingStatusCallback="/api/public/twilio/${token}/recording" recordingStatusCallbackMethod="POST" ` +
          `action="/api/public/twilio/${token}/voice-status" method="POST">` +
          `<Number>${escapeXml(to)}</Number></Dial>`;
        return xml(twiml);
      },
    },
  },
});
