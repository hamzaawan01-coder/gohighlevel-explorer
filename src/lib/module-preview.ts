import { MODULES, type ModuleDef, type ModuleState, isModuleEnabled } from "@/lib/modules";

export type ModulePreview = {
  /** Modules a workspace on this plan can reach. */
  unlocked: ModuleDef[];
  /** Modules the plan hides, even if toggled on in Modules settings. */
  blocked: ModuleDef[];
  /** Every route prefix that becomes reachable. */
  routes: string[];
  /** Compared with `baseline` (the currently saved plan / assignment). */
  added: ModuleDef[];
  removed: ModuleDef[];
};

/**
 * Pure preview of what a set of selected module keys unlocks. `baseline` is the
 * previously saved selection, so the editor can show "+Calls / −Reports".
 */
export function previewPlanModules(
  selected: string[],
  baseline?: string[] | null,
): ModulePreview {
  const selectedKeys = new Set(selected);
  const includes = (m: ModuleDef) => m.locked || selectedKeys.has(m.key);

  const unlocked = MODULES.filter(includes);
  const blocked = MODULES.filter((m) => !includes(m));

  let added: ModuleDef[] = [];
  let removed: ModuleDef[] = [];
  if (baseline) {
    const before = new Set(baseline);
    added = MODULES.filter((m) => !m.locked && selectedKeys.has(m.key) && !before.has(m.key));
    removed = MODULES.filter((m) => !m.locked && !selectedKeys.has(m.key) && before.has(m.key));
  }

  return {
    unlocked,
    blocked,
    routes: [...new Set(unlocked.flatMap((m) => m.paths))].sort(),
    added,
    removed,
  };
}

/**
 * A plan is a hard ceiling: modules it omits stay off regardless of the
 * workspace's own toggles.
 */
export function applyPlanCeiling(state: ModuleState, planModules: string[] | null): ModuleState {
  if (!planModules) return { ...state };
  const next: ModuleState = { ...state };
  for (const m of MODULES) {
    if (!m.locked && !planModules.includes(m.key)) next[m.key] = false;
  }
  return next;
}

/** Would this pathname be reachable under the given module state? */
export function isPathAllowed(state: ModuleState, pathname: string): boolean {
  const owner = MODULES.filter((m) =>
    m.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
  ).sort(
    (a, b) => Math.max(...b.paths.map((p) => p.length)) - Math.max(...a.paths.map((p) => p.length)),
  )[0];
  if (!owner) return true;
  return isModuleEnabled(state, owner.key);
}
