import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { requireSession } from "@/lib/session-ready";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type SubscriptionSignup = {
  subscription_id: string;
  sub_account_id: string;
  sub_account_name: string;
  agency_id: string;
  agency_name: string;
  plan_id: string | null;
  plan_name: string | null;
  price_cents: number | null;
  currency: string | null;
  billing_interval: string | null;
  status: string;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approver_name: string | null;
  rejection_reason: string | null;
  created_at: string;
};

/** Every signup the signed-in user is allowed to review. */
export async function fetchSignups(): Promise<SubscriptionSignup[]> {
  await requireSession();
  const { data, error } = await supabase.rpc("list_subscription_signups");
  if (error) throw error;
  return (data ?? []) as SubscriptionSignup[];
}

export function useSignups() {
  return useQuery({
    queryKey: ["subscription-signups"],
    queryFn: fetchSignups,
    staleTime: 15_000,
  });
}

export async function setSignupApproval(
  subAccountId: string,
  status: ApprovalStatus,
  reason?: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("set_subscription_approval", {
    _sub: subAccountId,
    _status: status,
    _reason: reason ?? null,
  });
  if (error) throw error;
}

/** True when the signed-in user holds the platform-wide admin role. */
export async function fetchIsGlobalAdmin(): Promise<boolean> {
  const session = await requireSession();
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export function useIsGlobalAdmin() {
  return useQuery({ queryKey: ["is-global-admin"], queryFn: fetchIsGlobalAdmin, staleTime: 300_000 });
}

export type SignupCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  paying: number;
  trialing: number;
  canceled: number;
  mrrCents: number;
};

export function summariseSignups(rows: SubscriptionSignup[]): SignupCounts {
  const counts: SignupCounts = {
    total: rows.length,
    pending: 0,
    approved: 0,
    rejected: 0,
    paying: 0,
    trialing: 0,
    canceled: 0,
    mrrCents: 0,
  };
  for (const r of rows) {
    counts[r.approval_status] += 1;
    if (r.status === "trialing") counts.trialing += 1;
    else if (r.status === "canceled") counts.canceled += 1;
    else if (r.status === "active" || r.status === "past_due") counts.paying += 1;
    if (r.approval_status === "approved" && (r.status === "active" || r.status === "past_due")) {
      const cents = r.price_cents ?? 0;
      counts.mrrCents += r.billing_interval === "year" ? Math.round(cents / 12) : cents;
    }
  }
  return counts;
}
