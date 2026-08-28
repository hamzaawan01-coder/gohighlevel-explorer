import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { MODULES, isModuleEnabled, setModuleEnabled, useModules } from "@/lib/modules";
import { ToggleLeft, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/modules")({
  head: () => ({
    meta: [
      { title: "Modules — Workspace settings" },
      {
        name: "description",
        content:
          "Turn CRM modules on or off per workspace so your team only sees the tools they actually use.",
      },
      { property: "og:title", content: "Modules — Workspace settings" },
      {
        property: "og:description",
        content: "Choose which CRM modules are visible in this workspace.",
      },
    ],
  }),
  component: ModulesSettingsPage,
});

function ModulesSettingsPage() {
  const { subId, state, isLoading } = useModules();
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      if (!subId) throw new Error("No workspace selected");
      await setModuleEnabled(subId, key, enabled);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sub-account-modules", subId] });
      toast.success(`${MODULES.find((m) => m.key === vars.key)?.label} ${vars.enabled ? "enabled" : "disabled"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      headerStatus={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ToggleLeft className="size-3.5" />
          <span className="text-foreground font-medium">Modules</span>
        </div>
      }
    >
      <div className="p-6 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-lg font-bold">Modules</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Turn parts of the CRM on or off for this workspace. Disabled modules disappear from the
            sidebar and their pages become unavailable — nothing is deleted, so you can switch them
            back on any time. Only workspace admins can change these.
          </p>
        </div>

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="bg-card border border-border rounded-lg divide-y divide-border">
            {MODULES.map((m) => {
              const on = isModuleEnabled(state, m.key);
              return (
                <div key={m.key} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      {m.label}
                      {m.locked ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                          <Lock className="size-3" /> always on
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{m.description}</p>
                  </div>
                  <Switch
                    checked={on}
                    disabled={m.locked || toggle.isPending}
                    onCheckedChange={(v) => toggle.mutate({ key: m.key, enabled: v })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
