import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env['SUPABASE_URL']!,
      process.env['SUPABASE_SERVICE_ROLE_KEY']!,
    );
  }
  return _supabase;
}

function periodEnd(subscription: any): string | null {
  const item = subscription.items?.data?.[0];
  const end = item?.current_period_end ?? subscription.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

async function upsertFromSubscription(subscription: any) {
  const subAccountId = subscription.metadata?.subAccountId;
  const planId = subscription.metadata?.planId ?? null;
  if (!subAccountId) {
    console.error("Subscription without subAccountId metadata", subscription.id);
    return;
  }
  await getSupabase()
    .from("sub_account_subscriptions")
    .upsert(
      {
        sub_account_id: subAccountId,
        ...(planId ? { plan_id: planId } : {}),
        status: subscription.status,
        current_period_end: periodEnd(subscription),
        stripe_customer_id:
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id,
        stripe_subscription_id: subscription.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sub_account_id" },
    );
}

async function markCanceled(subscription: any) {
  await getSupabase()
    .from("sub_account_subscriptions")
    .update({
      status: "canceled",
      current_period_end: periodEnd(subscription),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertFromSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await markCanceled(event.data.object);
      break;
    default:
      console.log("Unhandled payments event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Payments webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
