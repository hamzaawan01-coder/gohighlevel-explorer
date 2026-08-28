/**
 * Pure(ish) application of Stripe subscription events onto the workspace
 * subscription row. Kept out of the route file so it can be exercised by
 * tests with a fake database client.
 */

export type SubscriptionRowPatch = {
  sub_account_id: string;
  plan_id?: string | null;
  status: string;
  current_period_end: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id: string;
  updated_at: string;
};

/** Minimal surface we need from a Supabase-like client. */
export type WebhookDb = {
  upsertSubscription(patch: SubscriptionRowPatch): Promise<void>;
  cancelSubscription(
    stripeSubscriptionId: string,
    patch: { status: string; current_period_end: string | null; updated_at: string },
  ): Promise<void>;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

export function periodEnd(subscription: any): string | null {
  const item = subscription?.items?.data?.[0];
  // Basil moved period fields onto the item; keep the subscription fallback.
  const end = item?.current_period_end ?? subscription?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

function customerId(subscription: any): string | null {
  const c = subscription?.customer;
  return typeof c === "string" ? c : (c?.id ?? null);
}

export type ApplyResult =
  | { applied: true; action: "upsert" | "cancel" }
  | { applied: false; reason: string };

/**
 * Apply one Stripe event. Unknown events and subscriptions without workspace
 * metadata are ignored (and reported) rather than throwing — the webhook must
 * still answer 200 so Stripe doesn't retry forever.
 */
export async function applySubscriptionEvent(
  event: { type: string; data: { object: any } },
  db: WebhookDb,
): Promise<ApplyResult> {
  const subscription = event.data?.object;
  const now = new Date().toISOString();

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subAccountId = subscription?.metadata?.subAccountId;
      if (!subAccountId) return { applied: false, reason: "missing subAccountId metadata" };
      const planId = subscription?.metadata?.planId ?? null;
      await db.upsertSubscription({
        sub_account_id: subAccountId,
        ...(planId ? { plan_id: planId } : {}),
        status: subscription.status,
        current_period_end: periodEnd(subscription),
        stripe_customer_id: customerId(subscription),
        stripe_subscription_id: subscription.id,
        updated_at: now,
      });
      return { applied: true, action: "upsert" };
    }
    case "customer.subscription.deleted": {
      if (!subscription?.id) return { applied: false, reason: "missing subscription id" };
      await db.cancelSubscription(subscription.id, {
        status: "canceled",
        current_period_end: periodEnd(subscription),
        updated_at: now,
      });
      return { applied: true, action: "cancel" };
    }
    default:
      return { applied: false, reason: `unhandled event ${event.type}` };
  }
}
