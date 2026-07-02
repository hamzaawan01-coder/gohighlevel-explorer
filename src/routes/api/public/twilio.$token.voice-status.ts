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

        // Empty TwiML for <Dial action> continuations
        return new Response('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      },
    },
  },
});
