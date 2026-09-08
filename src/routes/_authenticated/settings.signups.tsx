import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { SettingsShell } from "@/components/SettingsNav";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { ConsoleSection, ConsoleStat, StatusPill } from "@/components/console";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, ErrorState, PanelSkeleton } from "@/components/ui/states";
import { formatPrice } from "@/lib/subscriptions";
import {
  summariseSignups,
  useIsGlobalAdmin,
  useSignups,
  setSignupApproval,
  type ApprovalStatus,
  type SubscriptionSignup,
} from "@/lib/signups";
import { toast } from "sonner";
import { CheckCircle2, RefreshCw, ShieldCheck, UserCheck, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings/signups")({
  head: () => ({
    meta: [
      { title: "Paid signups & approvals — Workspace settings" },
      {
        name: "description",
        content:
          "See every paid signup, how much it is worth, and approve or reject each workspace before its plan modules unlock.",
      },
      { property: "og:title", content: "Paid signups & approvals" },
      {
        property: "og:description",
        content: "Review paid signups and approve workspaces before their plan unlocks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SignupsPage,
});

const FILTERS: { key: "all" | ApprovalStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const label = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Awaiting approval";
  return <StatusPill ok={status === "approved"} label={label} />;
}

function SignupsPage() {
  const qc = useQueryClient();
  const signups = useSignups();
  const isAdmin = useIsGlobalAdmin();
  const [filter, setFilter] = useState<"all" | ApprovalStatus>("pending");
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<SubscriptionSignup | null>(null);
  const [reason, setReason] = useState("");

  const rows = signups.data ?? [];
  const counts = useMemo(() => summariseSignups(rows), [rows]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.approval_status === filter) &&
        (!q ||
          r.sub_account_name.toLowerCase().includes(q) ||
          r.agency_name.toLowerCase().includes(q) ||
          (r.plan_name ?? "").toLowerCase().includes(q)),
    );
  }, [rows, filter, search]);

  const decide = useMutation({
    mutationFn: (v: { subId: string; status: ApprovalStatus; reason?: string }) =>
      setSignupApproval(v.subId, v.status, v.reason),
    onSuccess: (_d, v) => {
      toast.success(v.status === "approved" ? "Signup approved — modules unlocked" : "Signup rejected");
      setRejecting(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["subscription-signups"] });
      void qc.invalidateQueries({ queryKey: ["sub-account-modules"] });
      void qc.invalidateQueries({ queryKey: ["workspace-subscription"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <PageHeader
        title="Paid signups & approvals"
        description="Every workspace that has taken a paid plan. Modules stay locked until you approve the signup."
        crumbs={[{ label: "Settings" }, { label: "Signups" }]}
        meta={
          <StatusPill
            ok={counts.pending === 0}
            label={counts.pending === 0 ? "Nothing waiting" : `${counts.pending} awaiting approval`}
          />
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => void signups.refetch()} disabled={signups.isFetching}>
            <RefreshCw className={`size-3.5 ${signups.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />
      <PageBody width="full">
        <SettingsShell>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ConsoleSection title="Paid signups">
            <ConsoleStat label="Active or past due" value={String(counts.paying)} />
            <ConsoleStat label="Trialing" value={String(counts.trialing)} />
          </ConsoleSection>
          <ConsoleSection title="Awaiting approval">
            <ConsoleStat label="Pending" value={String(counts.pending)} />
            <ConsoleStat label="Rejected" value={String(counts.rejected)} />
          </ConsoleSection>
          <ConsoleSection title="Approved">
            <ConsoleStat label="Workspaces live" value={String(counts.approved)} />
            <ConsoleStat label="Total signups" value={String(counts.total)} />
          </ConsoleSection>
          <ConsoleSection title="Recurring revenue">
            <ConsoleStat
              label="Approved MRR"
              value={formatPrice(counts.mrrCents, rows[0]?.currency ?? "usd", "month")}
            />
            <ConsoleStat label="Canceled" value={String(counts.canceled)} />
          </ConsoleSection>
        </div>

        <ConsoleSection
          title="Signups"
          icon={UserCheck}
          hint={isAdmin.data ? "Platform admin — all agencies" : "Your agencies"}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspace, agency or plan"
              className="h-8 w-full sm:w-64"
            />
          </div>

          {signups.isError ? (
            <ErrorState onRetry={() => signups.refetch()} error={signups.error} />
          ) : signups.isLoading ? (
            <PanelSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No signups here"
              description="When a workspace subscribes to a paid plan it appears here for approval."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Workspace</th>
                    <th className="py-2 pr-3 font-medium">Plan</th>
                    <th className="py-2 pr-3 font-medium">Billing</th>
                    <th className="py-2 pr-3 font-medium">Signed up</th>
                    <th className="py-2 pr-3 font-medium">Approval</th>
                    <th className="py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.subscription_id} className="border-b border-border/60 align-top">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{r.sub_account_name}</p>
                        <p className="text-xs text-muted-foreground">{r.agency_name}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <p>{r.plan_name ?? "—"}</p>
                        {r.price_cents != null && (
                          <p className="text-xs text-muted-foreground">
                            {formatPrice(r.price_cents, r.currency ?? "usd", r.billing_interval ?? "month")}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 capitalize">{r.status.replace("_", " ")}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 pr-3">
                        <ApprovalBadge status={r.approval_status} />
                        {r.approval_status === "approved" && r.approved_at && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {r.approver_name ?? "Admin"} · {new Date(r.approved_at).toLocaleDateString()}
                          </p>
                        )}
                        {r.approval_status === "rejected" && r.rejection_reason && (
                          <p className="mt-1 text-[11px] text-muted-foreground">{r.rejection_reason}</p>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="flex justify-end gap-2">
                          {r.approval_status !== "approved" && (
                            <Button
                              size="sm"
                              disabled={decide.isPending}
                              onClick={() =>
                                decide.mutate({ subId: r.sub_account_id, status: "approved" })
                              }
                            >
                              <CheckCircle2 className="size-3.5" />
                              Approve
                            </Button>
                          )}
                          {r.approval_status !== "rejected" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={decide.isPending}
                              onClick={() => {
                                setRejecting(r);
                                setReason("");
                              }}
                            >
                              <XCircle className="size-3.5" />
                              {r.approval_status === "approved" ? "Revoke" : "Reject"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ConsoleSection>
      </SettingsShell>
      </PageBody>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejecting?.approval_status === "approved" ? "Revoke access" : "Reject signup"}
              {rejecting ? ` — ${rejecting.sub_account_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason" className="text-xs">
              Reason (shown to the workspace)
            </Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Waiting on identity verification"
            />
            <p className="text-[11px] text-muted-foreground">
              Their plan modules lock immediately. You can approve again at any time.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={decide.isPending}
              onClick={() =>
                rejecting &&
                decide.mutate({
                  subId: rejecting.sub_account_id,
                  status: "rejected",
                  reason: reason.trim() || undefined,
                })
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
