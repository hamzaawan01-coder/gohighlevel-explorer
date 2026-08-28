import { History } from "lucide-react";
import { ConsoleSection } from "@/components/console";
import { EmptyState, ListSkeleton } from "@/components/ui/states";
import {
  auditActorLabel,
  describeAuditEntry,
  useSubscriptionAudit,
} from "@/lib/subscription-audit";
import type { SubscriptionPlan } from "@/lib/subscriptions";
import { MODULES } from "@/lib/modules";

const MODULE_LABEL = new Map(MODULES.map((m) => [m.key, m.label]));

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Who changed which workspace onto which plan, and when. */
export function SubscriptionAuditPanel({
  subAccountId,
  workspaceName,
  plans,
}: {
  subAccountId: string | null;
  workspaceName?: string | null;
  plans: SubscriptionPlan[];
}) {
  const { data, isLoading } = useSubscriptionAudit(subAccountId);
  const planName = (id: string | null) =>
    plans.find((p) => p.id === id)?.name ?? (id ? "Removed plan" : "no plan");

  return (
    <ConsoleSection
      title="Subscription history"
      icon={History}
      hint={workspaceName ?? "Current workspace"}
    >
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : !data?.length ? (
        <EmptyState
          compact
          icon={History}
          title="No changes yet"
          description="Plan assignments and billing updates for this workspace will be listed here."
        />
      ) : (
        <ol className="divide-y divide-border">
          {data.map((entry) => (
            <li key={entry.id} className="space-y-1 py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium">
                  {describeAuditEntry(entry, planName)}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {when(entry.created_at)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {auditActorLabel(entry)}
                {entry.status ? ` · ${entry.status}` : ""}
                {entry.source === "billing" ? " · via payments" : ""}
              </p>
              {entry.modules.length ? (
                <p className="text-[11px] text-muted-foreground">
                  Unlocked:{" "}
                  {entry.modules.map((m) => MODULE_LABEL.get(m) ?? m).join(", ")}
                </p>
              ) : entry.new_plan_id ? null : (
                <p className="text-[11px] text-muted-foreground">All modules available</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </ConsoleSection>
  );
}
