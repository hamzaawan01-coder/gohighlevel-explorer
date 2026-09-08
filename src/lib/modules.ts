import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchPlanModules } from "@/lib/subscriptions";
import { useTenancy } from "@/lib/tenancy";


export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  /** Route prefixes this module owns. */
  paths: string[];
  /** Core modules can never be turned off. */
  locked?: boolean;
};

export const MODULES: ModuleDef[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Overview of pipeline, tasks and activity.",
    paths: ["/dashboard"],
    locked: true,
  },
  {
    key: "opportunities",
    label: "Opportunities",
    description: "Pipelines, stages and deal kanban board.",
    paths: ["/opportunities", "/deals", "/pipeline"],
  },
  {
    key: "contacts",
    label: "Contacts",
    description: "Contact records, imports and detail panels.",
    paths: ["/contacts"],
  },
  {
    key: "tasks",
    label: "Tasks",
    description: "To-dos assigned to your team.",
    paths: ["/tasks"],
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "Client invoices with line items, tax and payment status.",
    paths: ["/invoices"],
  },
  {
    key: "calendar",
    label: "Calendar",
    description: "Appointments and booking pages.",
    paths: ["/calendar", "/settings/booking"],
  },
  {
    key: "conversations",
    label: "Conversations",
    description: "Two-way SMS, WhatsApp, email and social DMs.",
    paths: ["/conversations", "/inbox", "/messaging"],
  },
  {

    key: "mailbox",
    label: "Mailbox",
    description: "Each user signs in to their own Gmail or Outlook inbox inside the CRM.",
    paths: ["/mailbox"],
  },



  {
    key: "calls",
    label: "Calls & phone",
    description: "Softphone, call history, numbers and call flows.",
    paths: ["/calls", "/settings/phone-numbers", "/settings/call-flows"],
  },
  {
    key: "reports",
    label: "Reports",
    description: "Performance and conversion reporting.",
    paths: ["/reports"],
  },
  {
    key: "attribution",
    label: "Attribution",
    description: "Source-to-revenue attribution, ad spend ROI and call analytics.",
    paths: ["/attribution"],
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Campaigns, broadcasts and trackable links.",
    paths: ["/marketing"],
  },
  {
    key: "workflows",
    label: "Workflows",
    description: "Automations, triggers and scheduled sends.",
    paths: ["/workflows"],
  },
  {
    key: "templates",
    label: "Templates",
    description: "Reusable SMS and email message templates.",
    paths: ["/templates"],
  },
  {
    key: "forms",
    label: "Forms",
    description: "Public lead capture forms.",
    paths: ["/forms"],
  },
  {
    key: "recycle-bin",
    label: "Recycle bin",
    description: "Restore deleted contacts, opportunities, tasks and invoices.",
    paths: ["/recycle-bin"],
  },
  {
    key: "integrations",
    label: "Integrations",
    description: "Twilio, Meta, WordPress and other connections.",
    paths: ["/settings/integrations", "/settings/wordpress", "/settings/messaging"],
  },
];

export type ModuleState = Record<string, boolean>;

export function isModuleEnabled(state: ModuleState, key: string) {
  const def = MODULES.find((m) => m.key === key);
  if (def?.locked) return true;
  return state[key] !== false;
}

/** Find the module that owns a pathname, if any. */
export function moduleForPath(pathname: string): ModuleDef | undefined {
  const matches = MODULES.filter((m) =>
    m.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
  );
  // Prefer the most specific path match.
  return matches.sort(
    (a, b) => Math.max(...b.paths.map((p) => p.length)) - Math.max(...a.paths.map((p) => p.length)),
  )[0];
}

export async function fetchModuleState(subAccountId: string): Promise<ModuleState> {
  const { applyPlanCeiling } = await import("@/lib/module-preview");
  const [{ data, error }, planModules] = await Promise.all([
    supabase
      .from("sub_account_modules")
      .select("module_key, enabled")
      .eq("sub_account_id", subAccountId),
    fetchPlanModules(subAccountId).catch(() => null),
  ]);
  if (error) throw error;
  const state: ModuleState = {};
  for (const row of data ?? []) state[row.module_key] = row.enabled;
  // A subscription plan is a hard ceiling: modules it doesn't include stay off.
  return applyPlanCeiling(state, planModules);
}



export async function setModuleEnabled(
  subAccountId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("sub_account_modules")
    .upsert(
      { sub_account_id: subAccountId, module_key: moduleKey, enabled },
      { onConflict: "sub_account_id,module_key" },
    );
  if (error) throw error;
}

export function useModules() {
  const subId = useTenancy((s) => s.currentSubAccountId);
  const q = useQuery({
    queryKey: ["sub-account-modules", subId],
    enabled: !!subId,
    queryFn: () => fetchModuleState(subId!),
    staleTime: 60_000,
  });
  const state = q.data ?? {};
  return {
    subId,
    state,
    isLoading: q.isLoading,
    enabled: (key: string) => isModuleEnabled(state, key),
  };
}

/* ----------------------------- Audit trail ----------------------------- */

export type ModuleAuditEntry = {
  id: string;
  module_key: string;
  enabled: boolean;
  changed_by: string | null;
  source: string;
  created_at: string;
  actor_name: string | null;
};

export async function fetchModuleAudit(subAccountId: string): Promise<ModuleAuditEntry[]> {
  const { data, error } = await supabase
    .from("sub_account_module_audit")
    .select("id, module_key, enabled, changed_by, source, created_at")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
    .limit(100);
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
    actor_name: r.changed_by ? names.get(r.changed_by) ?? null : null,
  }));
}

export function useModuleAudit(subAccountId: string | null) {
  return useQuery({
    queryKey: ["sub-account-module-audit", subAccountId],
    enabled: !!subAccountId,
    queryFn: () => fetchModuleAudit(subAccountId!),
  });
}

/* ------------------------------- Presets ------------------------------- */

export async function fetchAgencyPresets(agencyId: string): Promise<ModuleState> {
  const { data, error } = await supabase
    .from("agency_module_presets")
    .select("module_key, enabled")
    .eq("agency_id", agencyId);
  if (error) throw error;
  const state: ModuleState = {};
  for (const row of data ?? []) state[row.module_key] = row.enabled;
  return state;
}

export async function setAgencyPreset(
  agencyId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("agency_module_presets")
    .upsert(
      { agency_id: agencyId, module_key: moduleKey, enabled },
      { onConflict: "agency_id,module_key" },
    );
  if (error) throw error;
}

/** Copy the current workspace's module configuration into the agency preset. */
export async function saveStateAsPreset(agencyId: string, state: ModuleState): Promise<void> {
  const rows = MODULES.filter((m) => !m.locked).map((m) => ({
    agency_id: agencyId,
    module_key: m.key,
    enabled: isModuleEnabled(state, m.key),
  }));
  const { error } = await supabase
    .from("agency_module_presets")
    .upsert(rows, { onConflict: "agency_id,module_key" });
  if (error) throw error;
}

export function useAgencyPresets(agencyId: string | null) {
  return useQuery({
    queryKey: ["agency-module-presets", agencyId],
    enabled: !!agencyId,
    queryFn: () => fetchAgencyPresets(agencyId!),
  });
}
