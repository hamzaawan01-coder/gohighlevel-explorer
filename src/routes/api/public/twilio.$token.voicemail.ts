// Voicemail — handles both <Record> completion and Twilio's transcription callback.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/twilio/$token/voicemail")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        const form = await request.formData();
        const callSid = String(form.get("CallSid") ?? "");
        const from = String(form.get("From") ?? form.get("Caller") ?? "");
        const to = String(form.get("To") ?? form.get("Called") ?? "");
        const recordingSid = String(form.get("RecordingSid") ?? "");
        const recordingUrl = String(form.get("RecordingUrl") ?? "");
        const duration = Number(form.get("RecordingDuration") ?? 0);
        const transcriptionText = form.get("TranscriptionText")
          ? String(form.get("TranscriptionText"))
          : null;
        const transcriptionStatus = form.get("TranscriptionStatus")
          ? String(form.get("TranscriptionStatus"))
          : null;

        if (!token) return new Response("Bad request", { status: 400 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await (supabaseAdmin as any)
          .from("twilio_connections")
          .select("id, sub_account_id")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!conn) return new Response("Unknown token", { status: 404 });

        // Transcription callback: update existing voicemail row
        if (transcriptionText !== null || transcriptionStatus !== null) {
          if (recordingSid) {
            await (supabaseAdmin as any)
              .from("voicemails")
              .update({
                transcription: transcriptionText,
                transcription_status: transcriptionStatus,
              })
              .eq("sub_account_id", conn.sub_account_id)
              .eq("recording_sid", recordingSid);
          }
          return new Response("ok", { status: 200 });
        }

        // Recording done → create voicemail row
        if (!recordingUrl || !recordingSid) {
          return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>', {
            status: 200, headers: { "Content-Type": "text/xml" },
          });
        }

        // Find call + number + contact
        const { data: numRow } = await (supabaseAdmin as any)
          .from("twilio_numbers")
          .select("id")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("phone_number", to)
          .maybeSingle();
        const { data: contact } = await (supabaseAdmin as any)
          .from("contacts")
          .select("id")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("phone", from)
          .maybeSingle();
        const { data: call } = await (supabaseAdmin as any)
          .from("phone_calls")
          .select("id")
          .eq("sub_account_id", conn.sub_account_id)
          .eq("call_sid", callSid)
          .maybeSingle();

        const vm = await (supabaseAdmin as any).from("voicemails").insert({
          sub_account_id: conn.sub_account_id,
          phone_call_id: call?.id ?? null,
          contact_id: contact?.id ?? null,
          twilio_number_id: numRow?.id ?? null,
          from_number: from,
          recording_sid: recordingSid,
          recording_url: `${recordingUrl}.mp3`,
          duration_seconds: duration || null,
        }).select("id").single();
        if (vm.data?.id) {
          const { notifyTeam } = await import("@/lib/twilio-inbound.server");
          await notifyTeam(supabaseAdmin as any, {
            subAccountId: conn.sub_account_id,
            title: `New voicemail from ${from}`,
            body: `${duration || 0}s — listen on the Calls page.`,
            link: "/calls",
          });
        }

        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you. Goodbye.</Say><Hangup/></Response>',
          { status: 200, headers: { "Content-Type": "text/xml" } },
        );
      },
    },
  },
});
