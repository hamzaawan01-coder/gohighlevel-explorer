import { beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ *
 * In-memory stand-in for the backend so the whole Subscriptions flow
 * (create plan → assign to workspace → gated routes) runs end to end.
 * ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

const db: Record<string, Row[]> = {
  subscription_plans: [],
  sub_account_subscriptions: [],
  sub_account_modules: [],
};

let ids = 0;
const nextId = () => `id-${++ids}`;

function table(name: string) {
  const filters: { col: string; value: unknown }[] = [];
  let inFilter: { col: string; values: unknown[] } | null = null;
  let staged: Row | null = null;

  const rows = () => db[name] ?? [];
  const match = () =>
    rows().filter(
      (r) =>
        filters.every((f) => r[f.col] === f.value) &&
        (!inFilter || inFilter.values.includes(r[inFilter.col])),
    );

  const api: Record<string, unknown> = {
    select: () => api,
    order: () => api,
    eq: (col: string, value: unknown) => {
      filters.push({ col, value });
      return api;
    },
    in: (col: string, values: unknown[]) => {
      inFilter = { col, values };
      return api;
    },
    insert: (row: Row) => {
      staged = { id: nextId(), created_at: new Date().toISOString(), ...row };
      rows().push(staged);
      return api;
    },
    upsert: (row: Row, opts?: { onConflict?: string }) => {
      const keys = (opts?.onConflict ?? "id").split(",").map((k) => k.trim());
      const existing = rows().find((r) => keys.every((k) => r[k] === row[k]));
      if (existing) Object.assign(existing, row);
      else rows().push({ id: nextId(), ...row });
      return Promise.resolve({ data: null, error: null });
    },
    update: (patch: Row) => {
      const target = match();
      // `.eq()` runs after `.update()` in the Supabase builder, so defer.
      return {
        eq: (col: string, value: unknown) => {
          for (const r of rows()) if (r[col] === value) Object.assign(r, patch);
          void target;
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
    single: () => Promise.resolve({ data: staged ?? match()[0] ?? null, error: null }),
    maybeSingle: () => Promise.resolve({ data: match()[0] ?? null, error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: match(), error: null }).then(resolve),
  };
  return api;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (name: string) => table(name),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: "u1" } } } }),
      onAuthStateChange: () => ({ subscription: { unsubscribe: () => {} } }),
    },
  },
}));

// Session gate: assume auth is ready in tests.
vi.mock("@/lib/session-ready", () => ({
  waitForSession: () => Promise.resolve(true),
  requireSession: () => Promise.resolve(),
  useSessionReady: () => ({ ready: true, authenticated: true }),
}));

const { createPlan, assignPlan, fetchPlans, fetchWorkspaceSubscription } = await import(
  "@/lib/subscriptions"
);
const { fetchModuleState, isModuleEnabled, MODULES } = await import("@/lib/modules");
const { isPathAllowed, previewPlanModules } = await import("@/lib/module-preview");

const AGENCY = "agency-1";
const WORKSPACE = "workspace-1";

describe("Subscriptions end to end", () => {
  beforeEach(() => {
    for (const key of Object.keys(db)) db[key] = [];
    ids = 0;
  });

  it("creates a plan with modules, assigns it, and gates routes accordingly", async () => {
    // 1. Create a plan that only includes Contacts + Tasks.
    const plan = await createPlan(AGENCY, {
      name: "Starter",
      description: "Contacts and tasks only",
      price_cents: 4900,
      currency: "gbp",
      billing_interval: "month",
      modules: ["contacts", "tasks"],
    });
    expect(plan.id).toBeTruthy();
    expect(await fetchPlans(AGENCY)).toHaveLength(1);

    // 2. Preview shows exactly what will unlock before saving.
    const preview = previewPlanModules(plan.modules);
    expect(preview.unlocked.map((m) => m.key)).toEqual(
      expect.arrayContaining(["dashboard", "contacts", "tasks"]),
    );
    expect(preview.blocked.map((m) => m.key)).toContain("reports");
    expect(preview.routes).toContain("/contacts");
    expect(preview.routes).not.toContain("/reports");

    // 3. Before assignment every module is reachable.
    let state = await fetchModuleState(WORKSPACE);
    expect(isModuleEnabled(state, "reports")).toBe(true);
    expect(isPathAllowed(state, "/reports")).toBe(true);

    // 4. Assign the plan to the client workspace.
    await assignPlan(WORKSPACE, plan.id);
    const sub = await fetchWorkspaceSubscription(WORKSPACE);
    expect(sub?.plan_id).toBe(plan.id);
    expect(sub?.status).toBe("active");

    // 5. Gated routes disappear; included routes stay.
    state = await fetchModuleState(WORKSPACE);
    expect(isModuleEnabled(state, "contacts")).toBe(true);
    expect(isModuleEnabled(state, "tasks")).toBe(true);
    expect(isModuleEnabled(state, "reports")).toBe(false);
    expect(isModuleEnabled(state, "marketing")).toBe(false);
    expect(isPathAllowed(state, "/reports")).toBe(false);
    expect(isPathAllowed(state, "/contacts/abc")).toBe(true);
    // Locked core module survives any plan.
    expect(isModuleEnabled(state, "dashboard")).toBe(true);
    expect(isPathAllowed(state, "/dashboard")).toBe(true);
  });

  it("re-assigning a richer plan brings gated routes back", async () => {
    const starter = await createPlan(AGENCY, {
      name: "Starter",
      price_cents: 0,
      currency: "gbp",
      billing_interval: "month",
      modules: ["contacts"],
    });
    const growth = await createPlan(AGENCY, {
      name: "Growth",
      price_cents: 9900,
      currency: "gbp",
      billing_interval: "month",
      modules: MODULES.filter((m) => !m.locked).map((m) => m.key),
    });

    await assignPlan(WORKSPACE, starter.id);
    expect(isPathAllowed(await fetchModuleState(WORKSPACE), "/reports")).toBe(false);

    const diff = previewPlanModules(growth.modules, starter.modules);
    expect(diff.added.map((m) => m.key)).toContain("reports");
    expect(diff.removed).toHaveLength(0);

    await assignPlan(WORKSPACE, growth.id);
    expect(isPathAllowed(await fetchModuleState(WORKSPACE), "/reports")).toBe(true);

    // Clearing the plan removes the ceiling entirely.
    await assignPlan(WORKSPACE, null);
    const cleared = await fetchModuleState(WORKSPACE);
    expect(isPathAllowed(cleared, "/marketing")).toBe(true);
  });

  it("workspace toggles cannot exceed the plan ceiling", async () => {
    const plan = await createPlan(AGENCY, {
      name: "Starter",
      price_cents: 0,
      currency: "gbp",
      billing_interval: "month",
      modules: ["contacts"],
    });
    await assignPlan(WORKSPACE, plan.id);
    // Workspace admin turns Reports on locally.
    db.sub_account_modules.push({
      id: "m1",
      sub_account_id: WORKSPACE,
      module_key: "reports",
      enabled: true,
    });

    const state = await fetchModuleState(WORKSPACE);
    expect(isModuleEnabled(state, "reports")).toBe(false);
  });
});
