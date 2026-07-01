import { supabase } from "@/integrations/supabase/client";

export type DashboardStats = {
  pipelineValue: number;
  openDeals: number;
  wonThisMonth: number;
  wonValueThisMonth: number;
  tasksDueToday: number;
  tasksOverdue: number;
  newContactsThisWeek: number;
  stageBreakdown: { stage: string; color: string; count: number; value: number }[];
  recentActivity: { id: string; kind: "deal" | "contact" | "task"; title: string; when: string }[];
};

export async function fetchDashboardStats(subAccountId: string): Promise<DashboardStats> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [stagesRes, dealsRes, tasksRes, contactsRes] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id,name,color,position")
      .eq("sub_account_id", subAccountId)
      .order("position"),
    supabase
      .from("deals")
      .select("id,title,value,stage_id,updated_at,created_at")
      .eq("sub_account_id", subAccountId),
    supabase
      .from("tasks")
      .select("id,title,status,due_at,updated_at,created_at")
      .eq("sub_account_id", subAccountId),
    supabase
      .from("contacts")
      .select("id,first_name,last_name,email,created_at")
      .eq("sub_account_id", subAccountId)
      .gte("created_at", startOfWeek),
  ]);

  const stages = stagesRes.data ?? [];
  const deals = dealsRes.data ?? [];
  const tasks = tasksRes.data ?? [];
  const newContacts = contactsRes.data ?? [];

  const lastStageId = stages.length ? stages[stages.length - 1].id : null;

  const openDeals = deals.filter((d) => d.stage_id !== lastStageId);
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value || 0), 0);

  const wonDeals = deals.filter(
    (d) => d.stage_id === lastStageId && d.updated_at >= startOfMonth,
  );

  const stageBreakdown = stages.map((s) => {
    const inStage = deals.filter((d) => d.stage_id === s.id);
    return {
      stage: s.name,
      color: s.color,
      count: inStage.length,
      value: inStage.reduce((sum, d) => sum + Number(d.value || 0), 0),
    };
  });

  const tasksDueToday = tasks.filter(
    (t) => t.due_at && t.due_at >= startOfDay && t.due_at < endOfDay && t.status !== "done",
  ).length;
  const tasksOverdue = tasks.filter(
    (t) => t.due_at && t.due_at < startOfDay && t.status !== "done",
  ).length;

  const activity: DashboardStats["recentActivity"] = [
    ...deals.map((d) => ({
      id: d.id,
      kind: "deal" as const,
      title: d.title,
      when: d.updated_at ?? d.created_at,
    })),
    ...tasks.map((t) => ({
      id: t.id,
      kind: "task" as const,
      title: t.title,
      when: t.updated_at ?? t.created_at,
    })),
    ...newContacts.map((c) => ({
      id: c.id,
      kind: "contact" as const,
      title:
        [c.first_name, c.last_name].filter(Boolean).join(" ") ||
        c.email ||
        "Untitled",
      when: c.created_at,
    })),
  ]
    .sort((a, b) => (a.when < b.when ? 1 : -1))
    .slice(0, 8);

  return {
    pipelineValue,
    openDeals: openDeals.length,
    wonThisMonth: wonDeals.length,
    wonValueThisMonth: wonDeals.reduce((s, d) => s + Number(d.value || 0), 0),
    tasksDueToday,
    tasksOverdue,
    newContactsThisWeek: newContacts.length,
    stageBreakdown,
    recentActivity: activity,
  };
}
