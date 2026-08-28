/**
 * Scheduled reconciliation of workspace subscription rows against Stripe.
 *
 * Bounded per run, single-flight via a database lease, idempotent (it only
 * writes when a field actually drifted) and it pauses itself when billing is
 * blocked (402/403) or repeatedly rate limited (429).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

export const RECONCILE_BATCH_SIZE = 25;
const LEASE_MINUTES = 5;
const RATE_LIMIT_PARK_AFTER = 3;

type SubRow = {
  sub_account_id: string;
  plan_id: string | null;
  status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type DriftPatch = {
  plan_id?: string | null;
  status?: string;
  current_period_end?: string | null;
  stripe_customer_id?: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function periodEndOf(subscription: any): string | null {
  const item = subscription?.items?.data?.[0];
  const end = item?.current_period_end ?? subscription?.current_period_end;
  return end ? new Date(end * 1000).toISOString() : null;
}

function customerIdOf(subscription: any): string | null {
  const c = subscription?.customer;
  return typeof c === "string" ? c : (c?.id ?? null);
}

/** Fields where the local row disagrees with Stripe. Empty object = in sync. */
export function diffSubscription(row: SubRow, stripeSub: any): DriftPatch {
  const patch: DriftPatch = {};
  const status = stripeSub?.status;
  if (status && status !== row.status) patch.status = status;

  const end = periodEndOf(stripeSub);
  const localEnd = row.current_period_end ? new Date(row.current_period_end).toISOString() : null;
  if (end !== localEnd) patch.current_period_end = end;

  const customer = customerIdOf(stripeSub);
  if (customer && customer !== row.stripe_customer_id) patch.stripe_customer_id = customer;

  const planId = stripeSub?.metadata?.planId ?? null;
  if (planId && planId !== row.plan_id) patch.plan_id = planId;

  return patch;
}

export type ReconcileOutcome = {
  ok: boolean;
  checked: number;
  fixed: number;
  skipped: number;
  paused?: string;
  details: Array<{ subAccountId: string; patch?: DriftPatch; error?: string }>;
};

function serviceClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  );
}

function statusOf(error: unknown): number | null {
  const e = error as { statusCode?: number; status?: number; raw?: { statusCode?: number } };
  return e?.statusCode ?? e?.status ?? e?.raw?.statusCode ?? null;
}

/**
 * Reconcile up to RECONCILE_BATCH_SIZE workspaces. Returns a summary; never
 * throws for per-row problems so the schedule keeps making progress.
 */
export async function reconcileSubscriptions(
  environment: StripeEnv = "sandbox",
): Promise<ReconcileOutcome> {
  const supabase = serviceClient();
  const outcome: ReconcileOutcome = { ok: true, checked: 0, fixed: 0, skipped: 0, details: [] };

  // Paused-state guard — schedulers keep firing regardless of job state.
  const { data: state } = await supabase
    .from("billing_reconcile_state")
    .select("paused_until, paused_reason, consecutive_rate_limits")
    .eq("id", "default")
    .maybeSingle();
  const pausedForever = !!state?.paused_reason && !state?.paused_until;
  const pausedUntil = state?.paused_until ? new Date(state.paused_until) : null;
  const paused = pausedForever || (pausedUntil ? pausedUntil > new Date() : false);
  // While paused we probe with a single row to detect out-of-band recovery.
  const limit = paused ? 1 : RECONCILE_BATCH_SIZE;

  const { data: leased } = await supabase.rpc("acquire_billing_reconcile_lease", {
    _minutes: LEASE_MINUTES,
  });
  if (!leased) {
    return { ...outcome, ok: false, skipped: 1, paused: "another run is in progress" };
  }

  try {
    const { data: rows, error } = await supabase
      .from("sub_account_subscriptions")
      .select(
        "sub_account_id, plan_id, status, current_period_end, stripe_customer_id, stripe_subscription_id",
      )
      .not("stripe_subscription_id", "is", null)
      .order("updated_at", { ascending: true })
      .limit(limit);
    if (error) throw error;

    const stripe = createStripeClient(environment);

    for (const row of (rows ?? []) as SubRow[]) {
      outcome.checked += 1;
      try {
        const stripeSub = await stripe.subscriptions.retrieve(row.stripe_subscription_id!);
        const patch = diffSubscription(row, stripeSub);
        if (Object.keys(patch).length === 0) continue;
        const { error: upErr } = await supabase
          .from("sub_account_subscriptions")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("sub_account_id", row.sub_account_id);
        if (upErr) throw upErr;
        outcome.fixed += 1;
        outcome.details.push({ subAccountId: row.sub_account_id, patch });
      } catch (e) {
        const code = statusOf(e);
        const message = getStripeErrorMessage(e);

        if (code === 404) {
          // Subscription no longer exists in Stripe → the workspace is canceled.
          await supabase
            .from("sub_account_subscriptions")
            .update({ status: "canceled", updated_at: new Date().toISOString() })
            .eq("sub_account_id", row.sub_account_id);
          outcome.fixed += 1;
          outcome.details.push({ subAccountId: row.sub_account_id, patch: { status: "canceled" } });
          continue;
        }

        if (code === 402 || code === 403 || code === 401) {
          // Circuit breaker: billing blocked — hold until an owner resumes.
          await supabase.rpc("pause_billing_reconcile", {
            _reason: `Billing blocked (${code}): ${message}`,
            _minutes: null as unknown as number,
          });
          outcome.ok = false;
          outcome.paused = message;
          outcome.details.push({ subAccountId: row.sub_account_id, error: message });
          break;
        }

        if (code === 429) {
          const next = (state?.consecutive_rate_limits ?? 0) + 1;
          await supabase
            .from("billing_reconcile_state")
            .update({ consecutive_rate_limits: next })
            .eq("id", "default");
          if (next >= RATE_LIMIT_PARK_AFTER) {
            // Transient: park until the next scheduled run.
            await supabase.rpc("pause_billing_reconcile", { _reason: "Rate limited", _minutes: 30 });
          }
          outcome.ok = false;
          outcome.paused = "rate limited";
          outcome.details.push({ subAccountId: row.sub_account_id, error: message });
          break;
        }

        outcome.skipped += 1;
        outcome.details.push({ subAccountId: row.sub_account_id, error: message });
      }
    }

    // A clean run clears any earlier pause / rate-limit streak.
    if (outcome.ok && (paused || (state?.consecutive_rate_limits ?? 0) > 0)) {
      await supabase.rpc("resume_billing_reconcile");
    }
    return outcome;
  } finally {
    await supabase.rpc("release_billing_reconcile_lease", {
      _result: outcome as unknown as Database["public"]["Tables"]["billing_reconcile_state"]["Row"]["last_result"],
    });
  }
}
