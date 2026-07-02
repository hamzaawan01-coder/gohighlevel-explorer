// Recording status callback — Twilio POSTs when a call recording completes.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/twilio/$token/recording")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        const form = await request.formData();
        const callSid = String(form.get("CallSid") ?? "");
        const recordingSid = String(form.get("RecordingSid") ?? "");
        const recordingUrl = String(form.get("RecordingUrl") ?? "");
        const duration = Number(form.get("RecordingDuration") ?? 0);

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
            recording_sid: recordingSid,
            recording_url: recordingUrl ? `${recordingUrl}.mp3` : null,
            recording_duration: duration || null,
          })
          .eq("sub_account_id", conn.sub_account_id)
          .eq("call_sid", callSid);

        return new Response("ok", { status: 200 });
      },
    },
  },
});
