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

/**
 * Idempotency: claim the event id before applying it. A replayed delivery hits
 * the unique index and is skipped, so audit rows and plan changes stay single.
 */
async function claimEvent(
  event: { id?: string; type: string },
  env: StripeEnv,
): Promise<boolean> {
  if (!event.id) return true; // nothing to dedupe on — apply once, best effort
  const { error } = await getSupabase()
    .from("stripe_webhook_events")
    .insert({ event_id: event.id, event_type: event.type, environment: env });
  if (!error) return true;
  // 23505 = unique violation → already processed.
  if ((error as { code?: string }).code === "23505") return false;
  throw error;
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
          const event = (await verifyWebhook(request, env)) as {
            id?: string;
            type: string;
            data: { object: unknown };
          };
          const fresh = await claimEvent(event, env);
          if (!fresh) {
            return Response.json({ received: true, duplicate: true });
          }
          const result = await applySubscriptionEvent(event as unknown as { type: string; data: { object: unknown } } as never, db());
          if (!result.applied) console.log("Payments webhook skipped:", result.reason);
          if (event.id) {
            await getSupabase()
              .from("stripe_webhook_events")
              .update({
                status: result.applied ? "processed" : "skipped",
                note: result.applied ? result.action : result.reason,
              })
              .eq("event_id", event.id);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payments webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
