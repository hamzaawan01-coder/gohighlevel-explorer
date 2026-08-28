import { supabase } from "@/integrations/supabase/client";

export type ReportData = {
  winRate: number;
  wonCount: number;
  lostCount: number;
  avgCycleDays: number | null;
  totalWonValue: number;
  dealsByWeek: { week: string; created: number; won: number }[];
  sourceBreakdown: { source: string; contacts: number; deals: number; value: number }[];
  repActivity: { name: string; deals: number; tasksDone: number; value: number }[];
};

function weekKey(d: Date): string {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = day.getDay();
  day.setDate(day.getDate() - dow);
  return day.toISOString().slice(0, 10);
}

/**
 * Teammate names come from an agency-scoped, signed-in-only function. Resolve
 * the workspace's real agency first and skip the lookup when there is no
 * session, so reports never fire a call that can only fail.
 */
async function fetchMemberNames(subAccountId: string): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const signedIn = await waitForSession();
  if (!signedIn) return names;


  const { data: sub } = await supabase
    .from("sub_accounts")
    .select("agency_id")
    .eq("id", subAccountId)
    .maybeSingle();
  if (!sub?.agency_id) return names;

  const { data } = await supabase.rpc("list_agency_members", { _agency: sub.agency_id });
  for (const m of (data ?? []) as { user_id: string; full_name: string | null }[]) {
    if (m.user_id) names.set(m.user_id, m.full_name || "Teammate");
  }
  return names;
}

export async function fetchReports(subAccountId: string): Promise<ReportData> {
  const [stagesRes, dealsRes, contactsRes, tasksRes, memberMap] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id,name,position")
      .eq("sub_account_id", subAccountId)
      .order("position"),
    supabase
      .from("deals")
      .select("id,title,value,stage_id,owner_id,contact_id,created_at,updated_at")
      .eq("sub_account_id", subAccountId),
    supabase
      .from("contacts")
      .select("id,lead_source,owner_id,created_at")
      .eq("sub_account_id", subAccountId),
    supabase
      .from("tasks")
      .select("id,assigned_to,status,completed_at")
      .eq("sub_account_id", subAccountId),
    fetchMemberNames(subAccountId),
  ]);

  const stages = stagesRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const contacts = contactsRes.data ?? [];
  const tasks = tasksRes.data ?? [];


  const wonStageId = stages.length ? stages[stages.length - 1].id : null;
  const lostStageId = stages.find((s) => /lost/i.test(s.name))?.id ?? null;

  const wonDeals = deals.filter((d) => d.stage_id === wonStageId);
  const lostDeals = lostStageId ? deals.filter((d) => d.stage_id === lostStageId) : [];
  const resolved = wonDeals.length + lostDeals.length;
  const winRate = resolved > 0 ? (wonDeals.length / resolved) * 100 : 0;

  const cycles = wonDeals
    .map((d) => {
      const c = new Date(d.created_at).getTime();
      const u = new Date(d.updated_at).getTime();
      return (u - c) / (1000 * 60 * 60 * 24);
    })
    .filter((n) => n >= 0 && Number.isFinite(n));
  const avgCycleDays = cycles.length
    ? Math.round((cycles.reduce((a, b) => a + b, 0) / cycles.length) * 10) / 10
    : null;

  // Last 8 weeks
  const now = new Date();
  const weeks: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    weeks.push(weekKey(d));
  }
  const dealsByWeek = weeks.map((w) => ({
    week: w.slice(5),
    created: deals.filter((d) => weekKey(new Date(d.created_at)) === w).length,
    won: wonDeals.filter((d) => weekKey(new Date(d.updated_at)) === w).length,
  }));

  // Source attribution
  const contactSource = new Map<string, string>();
  const sources = new Map<string, { contacts: number; deals: number; value: number }>();
  for (const c of contacts) {
    const src = (c.lead_source || "Unknown").trim() || "Unknown";
    contactSource.set(c.id, src);
    const s = sources.get(src) ?? { contacts: 0, deals: 0, value: 0 };
    s.contacts += 1;
    sources.set(src, s);
  }
  for (const d of deals) {
    const src = (d.contact_id && contactSource.get(d.contact_id)) || "Unknown";
    const s = sources.get(src) ?? { contacts: 0, deals: 0, value: 0 };
    s.deals += 1;
    s.value += Number(d.value || 0);
    sources.set(src, s);
  }
  const sourceBreakdown = Array.from(sources.entries())
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Per-rep
  const reps = new Map<string, { name: string; deals: number; tasksDone: number; value: number }>();
  for (const d of deals) {
    const key = d.owner_id || "unassigned";
    const r = reps.get(key) ?? {
      name: memberMap.get(key) || (key === "unassigned" ? "Unassigned" : "Teammate"),
      deals: 0,
      tasksDone: 0,
      value: 0,
    };
    r.deals += 1;
    r.value += Number(d.value || 0);
    reps.set(key, r);
  }
  for (const t of tasks) {
    if (t.status !== "done") continue;
    const key = t.assigned_to || "unassigned";
    const r = reps.get(key) ?? {
      name: memberMap.get(key) || (key === "unassigned" ? "Unassigned" : "Teammate"),
      deals: 0,
      tasksDone: 0,
      value: 0,
    };
    r.tasksDone += 1;
    reps.set(key, r);
  }
  const repActivity = Array.from(reps.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return {
    winRate: Math.round(winRate * 10) / 10,
    wonCount: wonDeals.length,
    lostCount: lostDeals.length,
    avgCycleDays,
    totalWonValue: wonDeals.reduce((s, d) => s + Number(d.value || 0), 0),
    dealsByWeek,
    sourceBreakdown,
    repActivity,
  };
}
