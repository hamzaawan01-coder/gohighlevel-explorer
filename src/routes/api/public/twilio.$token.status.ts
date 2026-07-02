// Public webhook — delivery status callbacks from Twilio.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/twilio/$token/status")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        const form = await request.formData();
        const messageSid = String(form.get("MessageSid") ?? "");
        const status = String(form.get("MessageStatus") ?? "");
        const errorCode = form.get("ErrorCode");
        const errorMessage = form.get("ErrorMessage");
        const accountSid = String(form.get("AccountSid") ?? "");

        if (!token || !messageSid) return new Response("Bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await (supabaseAdmin as any)
          .from("twilio_connections")
          .select("id, sub_account_id, account_sid")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!conn) return new Response("Unknown token", { status: 404 });
        if (accountSid && conn.account_sid !== accountSid) {
          return new Response("Account mismatch", { status: 401 });
        }

        await (supabaseAdmin as any)
          .from("messages")
          .update({
            delivery_status: status,
            error_message: errorCode
              ? `[${errorCode}] ${errorMessage ?? ""}`.trim()
              : (errorMessage ? String(errorMessage) : null),
          })
          .eq("sub_account_id", conn.sub_account_id)
          .eq("external_id", messageSid);

        return new Response("ok", { status: 200 });
      },
    },
  },
});
