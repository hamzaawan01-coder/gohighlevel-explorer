import { supabase } from "@/integrations/supabase/client";

export type Pipeline = {
  id: string;
  name: string;
  sub_account_id: string;
};

export type Stage = {
  id: string;
  pipeline_id: string;
  sub_account_id: string;
  name: string;
  color: string;
  position: number;
};

export type Deal = {
  id: string;
  pipeline_id: string;
  sub_account_id: string;
  stage_id: string;
  title: string;
  value: number;
  currency: string;
  position: number;
  notes: string | null;
  contact_id: string | null;
  expected_close_date: string | null;
};

const DEFAULT_STAGES = [
  { name: "New Leads", color: "#3b82f6", position: 0 },
  { name: "Qualified", color: "#10b981", position: 1 },
  { name: "Demo Scheduled", color: "#a855f7", position: 2 },
  { name: "Closing", color: "#f97316", position: 3 },
];

export async function ensureDefaultPipeline(
  userId: string,
  subAccountId: string,
): Promise<Pipeline> {
  const { data: existing, error: selErr } = await supabase
    .from("pipelines")
    .select("id,name,sub_account_id")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (selErr) throw selErr;
  if (existing && existing.length > 0) return existing[0] as Pipeline;

  const { data: pipeline, error: pErr } = await supabase
    .from("pipelines")
    .insert({ name: "Sales Pipeline", owner_id: userId, sub_account_id: subAccountId })
    .select("id,name,sub_account_id")
    .single();
  if (pErr) throw pErr;

  const { error: sErr } = await supabase.from("pipeline_stages").insert(
    DEFAULT_STAGES.map((s) => ({
      ...s,
      pipeline_id: pipeline.id,
      owner_id: userId,
      sub_account_id: subAccountId,
    })),
  );
  if (sErr) throw sErr;

  return pipeline as Pipeline;
}

export async function fetchBoard(pipelineId: string) {
  const [stagesRes, dealsRes] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true }),
    supabase
      .from("deals")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("position", { ascending: true }),
  ]);
  if (stagesRes.error) throw stagesRes.error;
  if (dealsRes.error) throw dealsRes.error;
  return {
    stages: (stagesRes.data ?? []) as Stage[],
    deals: (dealsRes.data ?? []) as Deal[],
  };
}

export async function createDeal(input: {
  pipeline_id: string;
  stage_id: string;
  sub_account_id: string;
  title: string;
  value: number;
  owner_id: string;
  contact_id?: string | null;
}) {
  const { data, error } = await supabase
    .from("deals")
    .insert({
      pipeline_id: input.pipeline_id,
      stage_id: input.stage_id,
      sub_account_id: input.sub_account_id,
      title: input.title,
      value: input.value,
      owner_id: input.owner_id,
      contact_id: input.contact_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function moveDeal(dealId: string, stageId: string, position: number) {
  const { error } = await supabase
    .from("deals")
    .update({ stage_id: stageId, position })
    .eq("id", dealId);
  if (error) throw error;
}

export async function fetchDeal(dealId: string): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .single();
  if (error) throw error;
  return data as Deal;
}

export type DealUpdate = Partial<{
  title: string;
  value: number;
  stage_id: string;
  notes: string | null;
  contact_id: string | null;
  expected_close_date: string | null;
}>;

export async function updateDeal(dealId: string, patch: DealUpdate): Promise<Deal> {
  const { data, error } = await supabase
    .from("deals")
    .update(patch)
    .eq("id", dealId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function deleteDeal(dealId: string): Promise<void> {
  const { error } = await supabase.from("deals").delete().eq("id", dealId);
  if (error) throw error;
}

