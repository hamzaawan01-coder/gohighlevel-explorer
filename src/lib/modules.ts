import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
    paths: ["/opportunities", "/deals"],
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
    key: "calendar",
    label: "Calendar",
    description: "Appointments and booking pages.",
    paths: ["/calendar", "/settings/booking"],
  },
  {
    key: "conversations",
    label: "Conversations",
    description: "Two-way SMS, WhatsApp, email and social DMs.",
    paths: ["/conversations", "/inbox"],
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
  const { data, error } = await supabase
    .from("sub_account_modules")
    .select("module_key, enabled")
    .eq("sub_account_id", subAccountId);
  if (error) throw error;
  const state: ModuleState = {};
  for (const row of data ?? []) state[row.module_key] = row.enabled;
  return state;
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
