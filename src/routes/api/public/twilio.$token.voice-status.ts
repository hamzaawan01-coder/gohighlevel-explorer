// Voice status callback — Twilio POSTs call completion metadata.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/twilio/$token/voice-status")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        const form = await request.formData();
        const callSid = String(form.get("CallSid") ?? "");
        const parentSid = String(form.get("ParentCallSid") ?? "") || null;
        const status = String(form.get("CallStatus") ?? "");
        const duration = Number(form.get("CallDuration") ?? form.get("DialCallDuration") ?? 0);
        const price = form.get("Price") ? Number(form.get("Price")) : null;
        const priceCurrency = form.get("PriceUnit") ? String(form.get("PriceUnit")) : null;

        if (!token || !callSid) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await (supabaseAdmin as any)
          .from("twilio_connections")
          .select("id, sub_account_id")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!conn) return new Response("Unknown token", { status: 404 });

        // Read the row first so we only fire a "missed call" note on the
        // transition out of ringing (dedups the Dial action + status callback).
        const { data: callRow } = await (supabaseAdmin as any)
          .from("phone_calls")
          .select("id, direction, from_number, status")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("call_sid", callSid)
          .maybeSingle();

        await (supabaseAdmin as any)
          .from("phone_calls")
          .update({
            status,
            duration_seconds: duration || null,
            parent_call_sid: parentSid,
            price,
            price_currency: priceCurrency,
            ended_at: ["completed", "failed", "busy", "no-answer", "canceled"].includes(status)
              ? new Date().toISOString()
              : null,
          })
          .eq("sub_account_id", conn.sub_account_id)
          .eq("call_sid", callSid);

        const wasRinging = ["ringing", "initiated", "queued"].includes(callRow?.status ?? "");
        const missed = ["no-answer", "busy", "canceled"].includes(status);
        if (callRow && callRow.direction === "inbound" && wasRinging && missed) {
          const { notifyTeam } = await import("@/lib/twilio-inbound.server");
          await notifyTeam(supabaseAdmin as any, {
            subAccountId: conn.sub_account_id,
            title: `Missed call from ${callRow.from_number}`,
            body: "They may call back — or leave a voicemail on the Calls page.",
            link: "/calls",
          });
        }

        // Empty TwiML for <Dial action> continuations
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
