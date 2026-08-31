import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenancy } from "@/lib/tenancy";

export type BillingInterval = "month" | "year";

export type SubscriptionPlan = {
  id: string;
  agency_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  modules: string[];
  stripe_price_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type WorkspaceSubscription = {
  id: string;
  sub_account_id: string;
  plan_id: string | null;
  status: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  approval_status: string;
  rejection_reason: string | null;
};

export const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

export function isSubscriptionActive(sub?: WorkspaceSubscription | null) {
  if (!sub) return false;
  if (ACTIVE_STATUSES.includes(sub.status)) return true;
  return (
    sub.status === "canceled" &&
    !!sub.current_period_end &&
    new Date(sub.current_period_end) > new Date()
  );
}

export function formatPrice(cents: number, currency: string, interval: string) {
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: (currency || "usd").toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
  return `${amount}/${interval === "year" ? "yr" : "mo"}`;
}

/* --------------------------------- Plans --------------------------------- */

export async function fetchPlans(agencyId: string): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select(
      "id, agency_id, name, description, price_cents, currency, billing_interval, modules, stripe_price_id, is_active, created_at",
    )
    .eq("agency_id", agencyId)
    .order("price_cents", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubscriptionPlan[];
}

export function usePlans(agencyId: string | null) {
  return useQuery({
    queryKey: ["subscription-plans", agencyId],
    enabled: !!agencyId,
    queryFn: () => fetchPlans(agencyId!),
  });
}

export type PlanInput = {
  name: string;
  description?: string | null;
  price_cents: number;
  currency: string;
  billing_interval: BillingInterval;
  modules: string[];
  is_active?: boolean;
};

export async function createPlan(agencyId: string, input: PlanInput): Promise<SubscriptionPlan> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .insert({ agency_id: agencyId, ...input })
    .select(
      "id, agency_id, name, description, price_cents, currency, billing_interval, modules, stripe_price_id, is_active, created_at",
    )
    .single();
  if (error) throw error;
  return data as SubscriptionPlan;
}

export async function updatePlan(planId: string, patch: Partial<PlanInput>): Promise<void> {
  const { error } = await supabase.from("subscription_plans").update(patch).eq("id", planId);
  if (error) throw error;
}

export async function deletePlan(planId: string): Promise<void> {
  const { error } = await supabase.from("subscription_plans").delete().eq("id", planId);
  if (error) throw error;
}

/* ----------------------------- Subscriptions ----------------------------- */

const SUB_COLS =
  "id, sub_account_id, plan_id, status, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, approval_status, rejection_reason";

export async function fetchWorkspaceSubscription(
  subAccountId: string,
): Promise<WorkspaceSubscription | null> {
  const { data, error } = await supabase
    .from("sub_account_subscriptions")
    .select(SUB_COLS)
    .eq("sub_account_id", subAccountId)
    .maybeSingle();
  if (error) throw error;
  return (data as WorkspaceSubscription | null) ?? null;
}

export async function fetchAgencySubscriptions(
  subAccountIds: string[],
): Promise<WorkspaceSubscription[]> {
  if (!subAccountIds.length) return [];
  const { data, error } = await supabase
    .from("sub_account_subscriptions")
    .select(SUB_COLS)
    .in("sub_account_id", subAccountIds);
  if (error) throw error;
  return (data ?? []) as WorkspaceSubscription[];
}

/** Assign (or clear) a plan for a workspace without charging a card. */
export async function assignPlan(
  subAccountId: string,
  planId: string | null,
  status = "active",
): Promise<void> {
  const { error } = await supabase.from("sub_account_subscriptions").upsert(
    { sub_account_id: subAccountId, plan_id: planId, status, approval_status: "approved" },
    { onConflict: "sub_account_id" },
  );
  if (error) throw error;
}

export function useWorkspaceSubscription(subAccountId?: string | null) {
  const current = useTenancy((s) => s.currentSubAccountId);
  const id = subAccountId ?? current;
  return useQuery({
    queryKey: ["workspace-subscription", id],
    enabled: !!id,
    queryFn: () => fetchWorkspaceSubscription(id!),
    staleTime: 30_000,
  });
}

/**
 * Modules unlocked by the workspace's active plan.
 * `null` means "no plan in force" — every module stays available.
 */
export async function fetchPlanModules(subAccountId: string): Promise<string[] | null> {
  const sub = await fetchWorkspaceSubscription(subAccountId);
  if (!sub || !sub.plan_id || !isSubscriptionActive(sub)) return null;
  // Approval gate: a paid signup unlocks nothing until it is approved.
  if (sub.approval_status !== "approved") return [];
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("modules")
    .eq("id", sub.plan_id)
    .maybeSingle();
  if (error) throw error;
  return (data?.modules as string[] | undefined) ?? null;
}
