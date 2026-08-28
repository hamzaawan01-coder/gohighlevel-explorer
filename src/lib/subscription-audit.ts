import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { waitForSession } from "@/lib/session-ready";

export type SubscriptionAuditEntry = {
  id: string;
  sub_account_id: string;
  old_plan_id: string | null;
  new_plan_id: string | null;
  status: string | null;
  modules: string[];
  changed_by: string | null;
  source: string;
  note: string | null;
  created_at: string;
  actor_name: string | null;
};

/**
 * Every plan assignment / status change for a workspace, newest first.
 * Written by a database trigger, so in-app assignments and automatic billing
 * updates both show up here.
 */
export async function fetchSubscriptionAudit(
  subAccountId: string,
): Promise<SubscriptionAuditEntry[]> {
  if (!(await waitForSession())) return [];
  const { data, error } = await supabase
    .from("sub_account_subscription_audit")
    .select(
      "id, sub_account_id, old_plan_id, new_plan_id, status, modules, changed_by, source, note, created_at",
    )
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[];
  const names = new Map<string, string | null>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    for (const p of profiles ?? []) names.set(p.id, p.full_name);
  }

  return rows.map((r) => ({
    ...r,
    modules: (r.modules as string[] | null) ?? [],
    actor_name: r.changed_by ? (names.get(r.changed_by) ?? null) : null,
  }));
}

export function useSubscriptionAudit(subAccountId: string | null) {
  return useQuery({
    queryKey: ["subscription-audit", subAccountId],
    enabled: !!subAccountId,
    queryFn: () => fetchSubscriptionAudit(subAccountId!),
  });
}

/** Human sentence for one audit entry. */
export function describeAuditEntry(
  entry: SubscriptionAuditEntry,
  planName: (id: string | null) => string,
): string {
  const from = entry.old_plan_id ? planName(entry.old_plan_id) : "no plan";
  const to = entry.new_plan_id ? planName(entry.new_plan_id) : "no plan";
  if (entry.old_plan_id === entry.new_plan_id) {
    return `${to} — status ${entry.status ?? "unknown"}`;
  }
  return `${from} → ${to}`;
}

export function auditActorLabel(entry: SubscriptionAuditEntry): string {
  if (entry.actor_name) return entry.actor_name;
  if (entry.source === "billing") return "Billing (automatic)";
  return entry.changed_by ? "Team member" : "System";
}

/* ------------------------------- CSV export ------------------------------ */

const CSV_HEADERS = [
  "changed_at",
  "workspace_id",
  "workspace",
  "changed_by_name",
  "changed_by_id",
  "source",
  "status",
  "old_plan",
  "new_plan",
  "modules_unlocked",
  "note",
] as const;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Audit log for one workspace as a CSV document. */
export function subscriptionAuditToCsv(
  entries: SubscriptionAuditEntry[],
  opts: { workspaceName?: string | null; planName: (id: string | null) => string },
): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const e of entries) {
    lines.push(
      [
        e.created_at,
        e.sub_account_id,
        opts.workspaceName ?? "",
        auditActorLabel(e),
        e.changed_by ?? "",
        e.source,
        e.status ?? "",
        e.old_plan_id ? opts.planName(e.old_plan_id) : "",
        e.new_plan_id ? opts.planName(e.new_plan_id) : "",
        e.modules.join("|"),
        e.note ?? "",
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n");
}
