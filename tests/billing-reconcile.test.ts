import { describe, expect, it } from "vitest";
import { diffSubscription } from "@/lib/billing-reconcile.server";

const row = {
  sub_account_id: "w1",
  plan_id: "p1",
  status: "active",
  current_period_end: "2026-09-01T00:00:00.000Z",
  stripe_customer_id: "cus_1",
  stripe_subscription_id: "sub_1",
};

const stripeSub = (over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  metadata: { planId: "p1" },
  items: { data: [{ current_period_end: Date.parse("2026-09-01T00:00:00.000Z") / 1000 }] },
  ...over,
});

describe("subscription drift detection", () => {
  it("reports no drift when in sync", () => {
    expect(diffSubscription(row, stripeSub())).toEqual({});
  });

  it("detects status drift", () => {
    expect(diffSubscription(row, stripeSub({ status: "past_due" }))).toEqual({
      status: "past_due",
    });
  });

  it("detects plan and period drift", () => {
    const patch = diffSubscription(
      row,
      stripeSub({
        metadata: { planId: "p2" },
        items: { data: [{ current_period_end: Date.parse("2026-10-01T00:00:00.000Z") / 1000 }] },
      }),
    );
    expect(patch).toEqual({
      plan_id: "p2",
      current_period_end: "2026-10-01T00:00:00.000Z",
    });
  });

  it("detects a changed billing customer", () => {
    expect(diffSubscription(row, stripeSub({ customer: { id: "cus_2" } }))).toEqual({
      stripe_customer_id: "cus_2",
    });
  });
});
