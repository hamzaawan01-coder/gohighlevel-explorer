import { beforeEach, describe, expect, it } from "vitest";
import {
  applySubscriptionEvent,
  periodEnd,
  type SubscriptionRowPatch,
  type WebhookDb,
} from "@/lib/payments-webhook.server";
import { applyPlanCeiling, isPathAllowed } from "@/lib/module-preview";
import { isSubscriptionActive } from "@/lib/subscriptions";

/* ------------------------------------------------------------------ *
 * Fake backend: one workspace subscription row + plan lookup, so a
 * Stripe event stream can be replayed and the resulting module gates
 * inspected exactly as the app would compute them.
 * ------------------------------------------------------------------ */

const WORKSPACE = "workspace-1";
const PLANS: Record<string, string[]> = {
  "plan-starter": ["contacts", "tasks"],
  "plan-growth": ["contacts", "tasks", "reports", "marketing", "conversations"],
};

let row: (SubscriptionRowPatch & { plan_id?: string | null }) | null = null;

const db: WebhookDb = {
  async upsertSubscription(patch) {
    row = row && row.sub_account_id === patch.sub_account_id ? { ...row, ...patch } : { ...patch };
  },
  async cancelSubscription(stripeSubscriptionId, patch) {
    if (row?.stripe_subscription_id === stripeSubscriptionId) row = { ...row, ...patch };
  },
};

/** Module gates the app would apply for the current row. */
function gates() {
  const sub = row
    ? {
        id: "s1",
        sub_account_id: row.sub_account_id,
        plan_id: row.plan_id ?? null,
        status: row.status,
        trial_ends_at: null,
        current_period_end: row.current_period_end,
        stripe_customer_id: row.stripe_customer_id ?? null,
        stripe_subscription_id: row.stripe_subscription_id,
      }
    : null;
  const planModules =
    sub && sub.plan_id && isSubscriptionActive(sub) ? (PLANS[sub.plan_id] ?? null) : null;
  return applyPlanCeiling({}, planModules);
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000);
const inDays = (n: number) => unix(new Date(Date.now() + n * 86_400_000));

function subscriptionObject(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    metadata: { subAccountId: WORKSPACE, planId: "plan-starter" },
    items: { data: [{ current_period_end: inDays(30) }] },
    ...overrides,
  };
}

const event = (type: string, object: unknown) => ({ type, data: { object } });

describe("Stripe subscription webhooks drive plan + module gating", () => {
  beforeEach(() => {
    row = null;
  });

  it("created: stores the plan and applies its module ceiling", async () => {
    const result = await applySubscriptionEvent(
      event("customer.subscription.created", subscriptionObject()),
      db,
    );
    expect(result).toEqual({ applied: true, action: "upsert" });
    expect(row?.plan_id).toBe("plan-starter");
    expect(row?.status).toBe("active");
    expect(row?.stripe_customer_id).toBe("cus_123");
    expect(row?.current_period_end).toBeTruthy();

    const state = gates();
    expect(isPathAllowed(state, "/contacts")).toBe(true);
    expect(isPathAllowed(state, "/reports")).toBe(false);
    expect(isPathAllowed(state, "/dashboard")).toBe(true);
  });

  it("updated: upgrading the plan unlocks the extra modules", async () => {
    await applySubscriptionEvent(
      event("customer.subscription.created", subscriptionObject()),
      db,
    );
    expect(isPathAllowed(gates(), "/reports")).toBe(false);

    await applySubscriptionEvent(
      event(
        "customer.subscription.updated",
        subscriptionObject({ metadata: { subAccountId: WORKSPACE, planId: "plan-growth" } }),
      ),
      db,
    );
    expect(row?.plan_id).toBe("plan-growth");
    expect(isPathAllowed(gates(), "/reports")).toBe(true);
    expect(isPathAllowed(gates(), "/marketing")).toBe(true);
  });

  it("updated to past_due keeps access; unpaid revokes gated modules", async () => {
    await applySubscriptionEvent(
      event("customer.subscription.created", subscriptionObject()),
      db,
    );

    await applySubscriptionEvent(
      event("customer.subscription.updated", subscriptionObject({ status: "past_due" })),
      db,
    );
    expect(isPathAllowed(gates(), "/contacts")).toBe(true);

    await applySubscriptionEvent(
      event("customer.subscription.updated", subscriptionObject({ status: "unpaid" })),
      db,
    );
    // No active plan in force → the ceiling lifts entirely.
    expect(isPathAllowed(gates(), "/reports")).toBe(true);
  });

  it("deleted: keeps access until period end, then drops the plan ceiling", async () => {
    await applySubscriptionEvent(
      event("customer.subscription.created", subscriptionObject()),
      db,
    );

    // Canceled with a future period end → grace period, gates unchanged.
    await applySubscriptionEvent(
      event("customer.subscription.deleted", subscriptionObject({ status: "canceled" })),
      db,
    );
    expect(row?.status).toBe("canceled");
    expect(isPathAllowed(gates(), "/contacts")).toBe(true);
    expect(isPathAllowed(gates(), "/reports")).toBe(false);

    // Same cancellation, but the period has already lapsed.
    await applySubscriptionEvent(
      event(
        "customer.subscription.deleted",
        subscriptionObject({
          status: "canceled",
          items: { data: [{ current_period_end: inDays(-1) }] },
        }),
      ),
      db,
    );
    expect(isPathAllowed(gates(), "/reports")).toBe(true);
  });

  it("ignores events without workspace metadata and unknown event types", async () => {
    expect(
      await applySubscriptionEvent(
        event("customer.subscription.created", subscriptionObject({ metadata: {} })),
        db,
      ),
    ).toEqual({ applied: false, reason: "missing subAccountId metadata" });
    expect(row).toBeNull();

    const unknown = await applySubscriptionEvent(event("invoice.payment_failed", {}), db);
    expect(unknown.applied).toBe(false);
  });

  it("reads the period end from the item or the subscription (Basil fallback)", () => {
    const ts = inDays(10);
    expect(periodEnd({ items: { data: [{ current_period_end: ts }] } })).toBe(
      new Date(ts * 1000).toISOString(),
    );
    expect(periodEnd({ current_period_end: ts })).toBe(new Date(ts * 1000).toISOString());
    expect(periodEnd({})).toBeNull();
  });

  it("an event for another workspace does not cancel this one", async () => {
    await applySubscriptionEvent(
      event("customer.subscription.created", subscriptionObject()),
      db,
    );
    await applySubscriptionEvent(
      event("customer.subscription.deleted", subscriptionObject({ id: "sub_other" })),
      db,
    );
    expect(row?.status).toBe("active");
  });
});
