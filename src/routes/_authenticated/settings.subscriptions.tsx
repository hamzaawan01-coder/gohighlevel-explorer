import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Layers, Package, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { SettingsNav } from "@/components/SettingsNav";
import { HeaderStat, PageBody, PageHeader } from "@/components/PageHeader";
import { ConsoleSection, ConsoleSplit, ConsoleTips, StatusPill } from "@/components/console";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PlanCheckoutDialog } from "@/components/PlanCheckoutDialog";
import { AssignPlanDialog } from "@/components/AssignPlanDialog";
import { SubscriptionAuditPanel } from "@/components/SubscriptionAuditPanel";
import { ModuleInclusionPreview } from "@/components/ModuleInclusionPreview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ListSkeleton } from "@/components/ui/states";
import { MODULES } from "@/lib/modules";
import { fetchMySubAccounts } from "@/lib/tenancy";
import { useTenancy } from "@/lib/tenancy";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";
import {
  createSubscriptionPortalSession,
  syncPlanToStripe,
} from "@/lib/subscriptions.functions";
import {
  type BillingInterval,
  type SubscriptionPlan,
  assignPlan,
  createPlan,
  deletePlan,
  fetchAgencySubscriptions,
  formatPrice,
  isSubscriptionActive,
  updatePlan,
  usePlans,
} from "@/lib/subscriptions";

export const Route = createFileRoute("/_authenticated/settings/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions & plans — Workspace settings" },
      {
        name: "description",
        content:
          "Build subscription plans, pick exactly which CRM modules each plan unlocks, and bill client workspaces by card.",
      },
      { property: "og:title", content: "Subscriptions & plans" },
      {
        property: "og:description",
        content: "Create client plans, choose included modules and charge subscriptions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SubscriptionsSettingsPage,
});

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  billing_interval: BillingInterval;
  modules: string[];
};

const emptyDraft: Draft = {
  name: "",
  description: "",
  price: "0",
  currency: "gbp",
  billing_interval: "month",
  modules: MODULES.filter((m) => !m.locked).map((m) => m.key),
};

function SubscriptionsSettingsPage() {
  const qc = useQueryClient();
  const currentSubId = useTenancy((s) => s.currentSubAccountId);
  const paymentsReady = isPaymentsConfigured();

  const { data: subs = [] } = useQuery({
    queryKey: ["my-sub-accounts"],
    queryFn: fetchMySubAccounts,
    staleTime: 60_000,
  });
  const agencyId = subs.find((s) => s.id === currentSubId)?.agency_id ?? subs[0]?.agency_id ?? null;
  const { data: plans = [], isLoading } = usePlans(agencyId);

  const workspaceIds = subs.map((s) => s.id);
  const { data: assignments = [] } = useQuery({
    queryKey: ["workspace-subscriptions", workspaceIds],
    enabled: workspaceIds.length > 0,
    queryFn: () => fetchAgencySubscriptions(workspaceIds),
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [checkout, setCheckout] = useState<{ planId: string; name: string } | null>(null);
  const [assignFlow, setAssignFlow] = useState<{
    open: boolean;
    workspaceId?: string | null;
    planId?: string | null;
  }>({ open: false });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["subscription-plans", agencyId] });
    qc.invalidateQueries({ queryKey: ["workspace-subscriptions", workspaceIds] });
    qc.invalidateQueries({ queryKey: ["sub-account-modules"] });
    qc.invalidateQueries({ queryKey: ["workspace-subscription"] });
  };

  const savePlan = useMutation({
    mutationFn: async (d: Draft) => {
      if (!agencyId) throw new Error("No agency found");
      const cents = Math.round(Number(d.price || "0") * 100);
      if (!d.name.trim()) throw new Error("Give the plan a name");
      if (Number.isNaN(cents) || cents < 0) throw new Error("Enter a valid price");
      const payload = {
        name: d.name.trim(),
        description: d.description.trim() || null,
        price_cents: cents,
        currency: d.currency,
        billing_interval: d.billing_interval,
        modules: d.modules,
      };
      const planId = d.id ?? (await createPlan(agencyId, payload)).id;
      if (d.id) await updatePlan(d.id, payload);
      if (paymentsReady && cents > 0) {
        const res = await syncPlanToStripe({
          data: { planId, environment: getStripeEnvironment() },
        });
        if ("error" in res) throw new Error(res.error);
      }
      return planId;
    },
    onSuccess: () => {
      setDraft(null);
      invalidate();
      toast.success("Plan saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (planId: string) => deletePlan(planId),
    onSuccess: () => {
      invalidate();
      toast.success("Plan removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: async (planId: string) => {
      const res = await syncPlanToStripe({
        data: { planId, environment: getStripeEnvironment() },
      });
      if ("error" in res) throw new Error(res.error);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Plan connected to payments");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assign = useMutation({
    mutationFn: ({ subId, planId }: { subId: string; planId: string | null }) =>
      assignPlan(subId, planId),
    onSuccess: () => {
      invalidate();
      toast.success("Plan assigned — modules updated for that workspace");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const portal = useMutation({
    mutationFn: async (subId: string) => {
      const res = await createSubscriptionPortalSession({
        data: {
          subAccountId: subId,
          returnUrl: `${window.location.origin}/settings/subscriptions`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in res) throw new Error(res.error);
      window.open(res.url, "_blank", "noopener");
      // Stripe's portal is a separate tab; refresh plan + module gating as soon
      // as the client comes back so changes there apply immediately.
      const refresh = () => {
        invalidate();
        qc.invalidateQueries({ queryKey: ["module-state"] });
        qc.invalidateQueries({ queryKey: ["subscription-audit"] });
      };
      const onFocus = () => {
        refresh();
        // Webhooks land a moment after the portal action; poll once more.
        window.setTimeout(refresh, 2500);
        window.removeEventListener("focus", onFocus);
      };
      window.addEventListener("focus", onFocus);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const auditWorkspaceId = assignFlow.workspaceId ?? currentSubId ?? subs[0]?.id ?? null;
  const planById = (id: string | null) => plans.find((p) => p.id === id);
  const activeCount = assignments.filter((a) => isSubscriptionActive(a) && a.plan_id).length;

  return (
    <AppShell>
      <PageHeader
        title="Subscriptions & plans"
        description="Package the CRM into plans, tick exactly which modules each plan includes, then assign or bill a plan per client workspace. Modules outside a workspace's active plan are hidden and their pages blocked."
        crumbs={[{ label: "Settings" }, { label: "Subscriptions" }]}
        meta={
          <>
            <StatusPill ok tone="primary" label="Live" />
            <HeaderStat label="Plans" value={String(plans.length)} />
            <HeaderStat label="Subscribed" value={String(activeCount)} />
          </>
        }
      />
      <PageBody width="full">
        <SettingsNav />
        <PaymentTestModeBanner />
        <ConsoleSplit
          main={
            <ConsoleSection
              title="Plans"
              icon={Package}
              hint="Agency-wide"
              actions={
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={subs.length === 0}
                    onClick={() => setAssignFlow({ open: true })}
                  >
                    <Layers className="size-3.5" /> Assign to workspace
                  </Button>
                  <Button type="button" size="sm" onClick={() => setDraft({ ...emptyDraft })}>
                    <Plus className="size-3.5" /> New plan
                  </Button>
                </div>
              }
            >
              {isLoading ? (
                <ListSkeleton rows={3} />
              ) : plans.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No plans yet"
                  description="Create your first plan — for example Starter with Contacts and Tasks, or Growth with everything."
                />
              ) : (
                <div className="divide-y divide-border">
                  {plans.map((plan) => (
                    <PlanRow
                      key={plan.id}
                      plan={plan}
                      onEdit={() =>
                        setDraft({
                          id: plan.id,
                          name: plan.name,
                          description: plan.description ?? "",
                          price: (plan.price_cents / 100).toString(),
                          currency: plan.currency,
                          billing_interval:
                            plan.billing_interval === "year" ? "year" : "month",
                          modules: plan.modules ?? [],
                        })
                      }
                      onSync={() => sync.mutate(plan.id)}
                      onDelete={() => remove.mutate(plan.id)}
                      onSubscribe={() => setCheckout({ planId: plan.id, name: plan.name })}
                      onAssign={() => setAssignFlow({ open: true, planId: plan.id })}
                      syncing={sync.isPending}
                      canCharge={paymentsReady && plan.price_cents > 0 && !!plan.stripe_price_id}
                    />
                  ))}
                </div>
              )}
            </ConsoleSection>
          }
          side={
            <>
              <ConsoleSection title="Client workspaces" icon={Layers} hint="Assigned plans">
                {subs.length === 0 ? (
                  <EmptyState compact icon={Layers} title="No workspaces yet." />
                ) : (
                  <div className="divide-y divide-border">
                    {subs.map((s) => {
                      const sub = assignments.find((a) => a.sub_account_id === s.id);
                      const plan = planById(sub?.plan_id ?? null);
                      return (
                        <div key={s.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold">{s.name}</p>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {sub && isSubscriptionActive(sub) ? sub.status : "no subscription"}
                            </span>
                          </div>
                          {sub?.plan_id && sub.approval_status !== "approved" && (
                            <Link
                              to="/settings/signups"
                              className="block rounded-md bg-secondary px-2 py-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                            >
                              {sub.approval_status === "rejected"
                                ? `Access revoked${sub.rejection_reason ? ` — ${sub.rejection_reason}` : ""}`
                                : "Awaiting approval — plan modules stay locked"}
                            </Link>
                          )}
                          <Select
                            value={sub?.plan_id ?? "none"}
                            onValueChange={(v) =>
                              assign.mutate({ subId: s.id, planId: v === "none" ? null : v })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="No plan" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No plan (all modules)</SelectItem>
                              {plans.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} — {formatPrice(p.price_cents, p.currency, p.billing_interval)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setAssignFlow({
                                  open: true,
                                  workspaceId: s.id,
                                  planId: sub?.plan_id ?? null,
                                })
                              }
                            >
                              Change plan
                            </Button>
                            {plan && paymentsReady && plan.price_cents > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  useTenancy.getState().setCurrent(s.id);
                                  setCheckout({ planId: plan.id, name: plan.name });
                                }}
                              >
                                <CreditCard className="size-3.5" /> Take payment
                              </Button>
                            ) : null}
                            {sub?.stripe_customer_id ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={portal.isPending}
                                onClick={() => portal.mutate(s.id)}
                              >
                                Manage billing
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ConsoleSection>

              <SubscriptionAuditPanel
                subAccountId={auditWorkspaceId}
                workspaceName={subs.find((s) => s.id === auditWorkspaceId)?.name ?? null}
                plans={plans}
              />

              <ConsoleTips
                items={[
                  "A plan is a hard ceiling: modules it doesn't include stay hidden even if toggled on in Modules.",
                  "Leave a workspace on “No plan” to give it access to everything.",
                  "Set a price above zero to charge by card; a £0 plan just controls access.",
                ]}
              />
            </>
          }
        />
      </PageBody>

      <PlanEditorDialog
        draft={draft}
        baseline={plans.find((p) => p.id === draft?.id)?.modules ?? null}
        onChange={setDraft}
        onSave={() => draft && savePlan.mutate(draft)}
        saving={savePlan.isPending}
      />
      <AssignPlanDialog
        open={assignFlow.open}
        onOpenChange={(o) => setAssignFlow((f) => ({ ...f, open: o }))}
        workspaces={subs}
        plans={plans}
        assignments={assignments}
        defaultWorkspaceId={assignFlow.workspaceId ?? currentSubId}
        defaultPlanId={assignFlow.planId ?? null}
        onAssigned={invalidate}
      />
      <PlanCheckoutDialog
        open={!!checkout}
        onOpenChange={(o) => !o && setCheckout(null)}
        planId={checkout?.planId ?? null}
        planName={checkout?.name}
        subAccountId={currentSubId}
      />
    </AppShell>
  );
}

function PlanRow({
  plan,
  onEdit,
  onSync,
  onDelete,
  onSubscribe,
  onAssign,
  syncing,
  canCharge,
}: {
  plan: SubscriptionPlan;
  onEdit: () => void;
  onSync: () => void;
  onDelete: () => void;
  onSubscribe: () => void;
  onAssign: () => void;
  syncing: boolean;
  canCharge: boolean;
}) {
  const included = MODULES.filter((m) => (plan.modules ?? []).includes(m.key));
  return (
    <div className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{plan.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatPrice(plan.price_cents, plan.currency, plan.billing_interval)}
            {plan.description ? ` · ${plan.description}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
            Edit
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onAssign}>
            <Layers className="size-3.5" /> Assign
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={syncing} onClick={onSync}>
            <RefreshCw className="size-3.5" /> Sync
          </Button>
          {canCharge ? (
            <Button type="button" size="sm" variant="ghost" onClick={onSubscribe}>
              <CreditCard className="size-3.5" /> Subscribe
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`Delete ${plan.name}`}
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {included.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">No modules included yet.</span>
        ) : (
          included.map((m) => (
            <span
              key={m.key}
              className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] font-medium"
            >
              {m.label}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function PlanEditorDialog({
  draft,
  baseline,
  onChange,
  onSave,
  saving,
}: {
  draft: Draft | null;
  baseline: string[] | null;
  onChange: (d: Draft | null) => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!draft) return null;
  const toggleModule = (key: string, on: boolean) =>
    onChange({
      ...draft,
      modules: on ? [...new Set([...draft.modules, key])] : draft.modules.filter((k) => k !== key),
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onChange(null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit plan" : "New plan"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Plan name</Label>
            <Input
              id="plan-name"
              value={draft.name}
              placeholder="Growth"
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-desc">Description</Label>
            <Textarea
              id="plan-desc"
              rows={2}
              value={draft.description}
              placeholder="What the client gets on this plan"
              onChange={(e) => onChange({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-price">Price</Label>
              <Input
                id="plan-price"
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => onChange({ ...draft, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={draft.currency}
                onValueChange={(v) => onChange({ ...draft, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gbp">GBP</SelectItem>
                  <SelectItem value="usd">USD</SelectItem>
                  <SelectItem value="eur">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Billing</Label>
              <Select
                value={draft.billing_interval}
                onValueChange={(v) =>
                  onChange({ ...draft, billing_interval: v as BillingInterval })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="year">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Included modules</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODULES.map((m) => (
                <label
                  key={m.key}
                  className="flex items-start gap-2 rounded-md border border-border p-2 text-xs"
                >
                  <Checkbox
                    checked={m.locked || draft.modules.includes(m.key)}
                    disabled={m.locked}
                    onCheckedChange={(v) => toggleModule(m.key, v === true)}
                    aria-label={`Include ${m.label}`}
                  />
                  <span className="min-w-0">
                    <span className="block font-semibold">{m.label}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {m.locked ? "Always included" : m.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <ModuleInclusionPreview selected={draft.modules} baseline={baseline} />
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onChange(null)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
