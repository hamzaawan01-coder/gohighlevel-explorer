import { Download, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/contacts-csv";
import { ConsoleSection } from "@/components/console";
import { EmptyState, ListSkeleton } from "@/components/ui/states";
import {
  auditActorLabel,
  describeAuditEntry,
  subscriptionAuditToCsv,
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
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!data?.length}
          onClick={() => {
            if (!data?.length) return;
            const slug = (workspaceName ?? "workspace")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "");
            downloadCsv(
              `subscription-audit-${slug || "workspace"}-${new Date().toISOString().slice(0, 10)}.csv`,
              subscriptionAuditToCsv(data, { workspaceName, planName }),
            );
            toast.success(`Exported ${data.length} audit ${data.length === 1 ? "entry" : "entries"}`);
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      }
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
