import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { applySubscriptionEvent, type WebhookDb } from "@/lib/payments-webhook.server";
import { applyInvoicePaymentEvent, type InvoicePaymentDb } from "@/lib/invoice-payments.server";

/** Invoice payment sync: mark paid + append to the invoice audit trail. */
function invoiceDb(): InvoicePaymentDb {
  return {
    async markPaid({ invoiceId, amountPaid, paymentIntentId, checkoutSessionId, paidAt }) {
      const { data, error } = await getSupabase()
        .from("invoices")
        .update({
          status: "paid",
          paid_at: paidAt,
          amount_paid: amountPaid,
          ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
          ...(checkoutSessionId ? { stripe_checkout_session_id: checkoutSessionId } : {}),
        } as never)
        .eq("id", invoiceId)
        .select("sub_account_id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { subAccountId: (data as { sub_account_id: string }).sub_account_id };
    },
    async logEvent({ invoiceId, subAccountId, type, detail }) {
      await getSupabase()
        .from("invoice_events")
        .insert({
          invoice_id: invoiceId,
          sub_account_id: subAccountId,
          type,
          detail: detail as never,
        } as never);
    },
  };
}

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
          const typed = event as Parameters<typeof applySubscriptionEvent>[0];
          const result = await applySubscriptionEvent(typed, db());
          const invoiceResult = await applyInvoicePaymentEvent(typed, invoiceDb());
          if (!result.applied) console.log("Payments webhook (subscription) skipped:", result.reason);
          if (!invoiceResult.applied) console.log("Payments webhook (invoice) skipped:", invoiceResult.reason);
          const applied = result.applied || invoiceResult.applied;
          const note = result.applied
            ? result.action
            : invoiceResult.applied
              ? `invoice paid ${invoiceResult.invoiceId}`
              : `${result.reason}; ${invoiceResult.reason}`;
          if (event.id) {
            await getSupabase()
              .from("stripe_webhook_events")
              .update({ status: applied ? "processed" : "skipped", note })
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
