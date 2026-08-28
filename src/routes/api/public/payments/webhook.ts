import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { applySubscriptionEvent, type WebhookDb } from "@/lib/payments-webhook.server";

let _supabase: ReturnType<typeof createClient<Database>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<Database>(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    );
  }
  return _supabase;
}

function db(): WebhookDb {
  return {
    async upsertSubscription(patch) {
      const { error } = await getSupabase()
        .from("sub_account_subscriptions")
        .upsert(patch, { onConflict: "sub_account_id" });
      if (error) throw error;
    },
    async cancelSubscription(stripeSubscriptionId, patch) {
      const { error } = await getSupabase()
        .from("sub_account_subscriptions")
        .update(patch)
        .eq("stripe_subscription_id", stripeSubscriptionId);
      if (error) throw error;
    },
  };
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          const result = await applySubscriptionEvent(event, db());
          if (!result.applied) console.log("Payments webhook skipped:", result.reason);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payments webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
