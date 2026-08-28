import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModuleInclusionPreview } from "@/components/ModuleInclusionPreview";
import { MODULES } from "@/lib/modules";
import type { SubAccount } from "@/lib/tenancy";
import {
  type SubscriptionPlan,
  type WorkspaceSubscription,
  assignPlan,
  formatPrice,
} from "@/lib/subscriptions";

const ALL_MODULES = MODULES.map((m) => m.key);

/**
 * One place to pick a client workspace, pick a plan, see exactly what changes,
 * and apply it.
 */
export function AssignPlanDialog({
  open,
  onOpenChange,
  workspaces,
  plans,
  assignments,
  defaultWorkspaceId,
  defaultPlanId,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: SubAccount[];
  plans: SubscriptionPlan[];
  assignments: WorkspaceSubscription[];
  defaultWorkspaceId?: string | null;
  defaultPlanId?: string | null;
  onAssigned?: () => void;
}) {
  const qc = useQueryClient();
  const [workspaceId, setWorkspaceId] = useState(defaultWorkspaceId ?? "");
  const [planId, setPlanId] = useState(defaultPlanId ?? "none");

  useEffect(() => {
    if (!open) return;
    setWorkspaceId(defaultWorkspaceId ?? workspaces[0]?.id ?? "");
    setPlanId(defaultPlanId ?? "none");
  }, [open, defaultWorkspaceId, defaultPlanId, workspaces]);

  const current = assignments.find((a) => a.sub_account_id === workspaceId);
  const currentPlan = plans.find((p) => p.id === current?.plan_id) ?? null;
  const nextPlan = plans.find((p) => p.id === planId) ?? null;

  const selected = nextPlan ? nextPlan.modules ?? [] : ALL_MODULES;
  const baseline = currentPlan ? currentPlan.modules ?? [] : ALL_MODULES;

  const apply = useMutation({
    mutationFn: () => assignPlan(workspaceId, planId === "none" ? null : planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["workspace-subscription"] });
      qc.invalidateQueries({ queryKey: ["sub-account-modules"] });
      toast.success(
        nextPlan
          ? `${nextPlan.name} applied — modules updated for that workspace`
          : "Plan cleared — that workspace can reach every module",
      );
      onAssigned?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="size-4 text-primary" /> Assign a plan to a workspace
          </DialogTitle>
          <DialogDescription>
            Pick the client, pick the plan, check the preview, then apply. Access changes
            immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Client workspace</Label>
            <Select value={workspaceId} onValueChange={setWorkspaceId}>
              <SelectTrigger aria-label="Client workspace">
                <SelectValue placeholder="Choose a workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Currently on: {currentPlan ? currentPlan.name : "no plan (all modules)"}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger aria-label="Plan">
                <SelectValue placeholder="Choose a plan" />
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
          </div>

          <ModuleInclusionPreview
            selected={selected}
            baseline={baseline}
            title="After assigning"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!workspaceId || apply.isPending}
            onClick={() => apply.mutate()}
          >
            {apply.isPending ? "Applying…" : "Apply plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
