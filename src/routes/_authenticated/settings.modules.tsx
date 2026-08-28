import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import {
  MODULES,
  isModuleEnabled,
  setModuleEnabled,
  setAgencyPreset,
  saveStateAsPreset,
  useAgencyPresets,
  useModuleAudit,
  useModules,
} from "@/lib/modules";
import { fetchMySubAccounts } from "@/lib/tenancy";
import { ToggleLeft, Lock, History, Layers, Save } from "lucide-react";
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

  const { data: subs = [] } = useQuery({
    queryKey: ["my-sub-accounts"],
    queryFn: fetchMySubAccounts,
    staleTime: 60_000,
  });
  const agencyId = subs.find((s) => s.id === subId)?.agency_id ?? null;
  const { data: presets = {}, isLoading: presetsLoading } = useAgencyPresets(agencyId);
  const audit = useModuleAudit(subId);

  const togglePreset = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      if (!agencyId) throw new Error("No agency found");
      await setAgencyPreset(agencyId, key, enabled);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency-module-presets", agencyId] });
      toast.success("Default updated for new workspaces");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyToPreset = useMutation({
    mutationFn: async () => {
      if (!agencyId) throw new Error("No agency found");
      await saveStateAsPreset(agencyId, state);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency-module-presets", agencyId] });
      toast.success("Saved this workspace's setup as the default preset");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      if (!subId) throw new Error("No workspace selected");
      await setModuleEnabled(subId, key, enabled);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["sub-account-modules", subId] });
      qc.invalidateQueries({ queryKey: ["sub-account-module-audit", subId] });
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

        <section className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Layers className="size-3.5" /> Defaults for new workspaces
              </h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                New workspaces created in this agency start with this configuration. Changing a
                preset never affects workspaces that already exist.
              </p>
            </div>
            <button
              type="button"
              disabled={!agencyId || copyToPreset.isPending}
              onClick={() => copyToPreset.mutate()}
              className="inline-flex shrink-0 items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/70 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              Use this workspace as the default
            </button>
          </div>
          {presetsLoading ? (
            <p className="text-xs text-muted-foreground">Loading defaults…</p>
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {MODULES.filter((m) => !m.locked).map((m) => (
                <div key={m.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <p className="text-xs font-medium">{m.label}</p>
                  <Switch
                    checked={presets[m.key] !== false}
                    disabled={!agencyId || togglePreset.isPending}
                    onCheckedChange={(v) => togglePreset.mutate({ key: m.key, enabled: v })}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2">
              <History className="size-3.5" /> Change history
            </h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              Every module switch in this workspace is recorded with who made the change and when.
            </p>
          </div>
          {audit.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading history…</p>
          ) : (audit.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No module changes recorded yet.</p>
          ) : (
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {(audit.data ?? []).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <p className="text-xs">
                    <span className="font-semibold">
                      {MODULES.find((m) => m.key === e.module_key)?.label ?? e.module_key}
                    </span>{" "}
                    <span className={e.enabled ? "text-primary" : "text-muted-foreground"}>
                      {e.enabled ? "turned on" : "turned off"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      by {e.actor_name ?? (e.source === "system" ? "system" : "a teammate")}
                    </span>
                  </p>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
