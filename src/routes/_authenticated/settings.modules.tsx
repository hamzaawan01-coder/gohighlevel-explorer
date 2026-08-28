import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { PageHeader, PageBody, HeaderStat } from "@/components/PageHeader";
import { ConsoleSection, ConsoleSplit, ConsoleTips, StatusPill } from "@/components/console";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { EmptyState, ListSkeleton } from "@/components/ui/states";

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

  const enabledCount = MODULES.filter((m) => isModuleEnabled(state, m.key)).length;

  return (
    <AppShell>
      <PageHeader
        title="Modules"
        description="Turn parts of the CRM on or off for this workspace. Disabled modules disappear from the sidebar and their pages become unavailable — nothing is deleted, so you can switch them back on any time. Only workspace admins can change these."
        crumbs={[{ label: "Settings" }, { label: "Modules" }]}
        meta={
          <>
            <StatusPill ok tone="primary" label="Live" />
            <HeaderStat label="Enabled" value={`${enabledCount}/${MODULES.length}`} />
          </>
        }
      />
      <PageBody width="full">
        <ConsoleSplit
          main={
            <ConsoleSection title="Modules" icon={ToggleLeft} hint="This workspace">
              {isLoading ? (
                <ListSkeleton rows={MODULES.length || 6} />
              ) : (
                <div className="divide-y divide-border">
                  {MODULES.map((m) => {
                    const on = isModuleEnabled(state, m.key);
                    return (
                      <div
                        key={m.key}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 first:pt-0 last:pb-0 sm:flex sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate text-sm font-semibold">
                            <span className="truncate">{m.label}</span>
                            {m.locked ? (
                              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                <Lock className="size-3" /> always on
                              </span>
                            ) : null}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">{m.description}</p>
                        </div>
                        <Switch
                          aria-label={`Toggle ${m.label}`}
                          checked={on}
                          disabled={m.locked || toggle.isPending}
                          onCheckedChange={(v) => toggle.mutate({ key: m.key, enabled: v })}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </ConsoleSection>
          }
          side={
            <>
              <ConsoleSection
                title="Defaults for new workspaces"
                icon={Layers}
                hint="Agency-wide"
                actions={
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!agencyId || copyToPreset.isPending}
                    onClick={() => copyToPreset.mutate()}
                  >
                    <Save className="size-3.5" />
                    Use this workspace
                  </Button>
                }
              >
                <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                  New workspaces created in this agency start with this configuration. Changing a
                  preset never affects workspaces that already exist.
                </p>
                {presetsLoading ? (
                  <ListSkeleton rows={4} />
                ) : (
                  <div className="divide-y divide-border">
                    {MODULES.filter((m) => !m.locked).map((m) => (
                      <div key={m.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
                        <Label htmlFor={`preset-${m.key}`} className="truncate text-xs font-medium">
                          {m.label}
                        </Label>
                        <Switch
                          id={`preset-${m.key}`}
                          aria-label={`Toggle default for ${m.label}`}
                          checked={presets[m.key] !== false}
                          disabled={!agencyId || togglePreset.isPending}
                          onCheckedChange={(v) => togglePreset.mutate({ key: m.key, enabled: v })}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </ConsoleSection>

              <ConsoleSection title="Change history" icon={History} hint="Recent">
                {audit.isLoading ? (
                  <ListSkeleton rows={4} />
                ) : (audit.data ?? []).length === 0 ? (
                  <EmptyState compact icon={History} title="No module changes recorded yet." />
                ) : (
                  <div className="divide-y divide-border">
                    {(audit.data ?? []).map((e) => (
                      <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                        <p className="min-w-0 truncate text-xs">
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
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {new Date(e.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ConsoleSection>

              <ConsoleTips
                items={[
                  "Disabling a module hides it instantly for every user in this workspace.",
                  "Locked modules are core to the CRM and can't be turned off.",
                  "Presets only affect brand-new workspaces going forward.",
                ]}
              />
            </>
          }
        />
      </PageBody>
    </AppShell>
  );
}
