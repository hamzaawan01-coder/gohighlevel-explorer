import { supabase } from "@/integrations/supabase/client";
import type { LifecycleStage } from "@/lib/contacts";
import type { TaskPriority } from "@/lib/tasks";

export type WorkflowTrigger =
  | "contact.created"
  | "contact.stage_changed"
  | "deal.created"
  | "deal.stage_changed"
  | "task.completed"
  | "form.submitted"
  | "task.due_soon"
  | "contact.stale"
  | "link.clicked";

export const WORKFLOW_TRIGGERS: { value: WorkflowTrigger; label: string }[] = [
  { value: "contact.created", label: "Contact created" },
  { value: "contact.stage_changed", label: "Contact stage changed" },
  { value: "deal.created", label: "New opportunity created" },
  { value: "deal.stage_changed", label: "Deal moved to stage" },
  { value: "task.completed", label: "Task completed" },
  { value: "form.submitted", label: "Form submitted" },
  { value: "task.due_soon", label: "Task due soon (scheduled)" },
  { value: "contact.stale", label: "Contact went stale (scheduled)" },
  { value: "link.clicked", label: "Trigger link clicked" },
];

export type WorkflowAction =
  | { type: "create_task"; title: string; priority?: TaskPriority; due_in_days?: number }
  | { type: "set_contact_stage"; stage: LifecycleStage }
  | { type: "add_contact_tag"; tag: string }
  | { type: "create_notification"; title: string; body?: string; link?: string }
  | { type: "send_email"; to?: string; subject: string; body_html?: string; body_text?: string }
  | { type: "send_sms"; to?: string; body: string };

export const WORKFLOW_ACTION_TYPES: { value: WorkflowAction["type"]; label: string }[] = [
  { value: "create_task", label: "Create task" },
  { value: "set_contact_stage", label: "Set contact stage" },
  { value: "add_contact_tag", label: "Add tag to contact" },
  { value: "create_notification", label: "Send in-app notification" },
  { value: "send_email", label: "Send email" },
  { value: "send_sms", label: "Send SMS" },
];

export type Workflow = {
  id: string;
  sub_account_id: string;
  name: string;
  enabled: boolean;
  trigger_type: WorkflowTrigger;
  trigger_config: Record<string, unknown>;
  actions: WorkflowAction[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type WorkflowRun = {
  id: string;
  workflow_id: string;
  sub_account_id: string;
  trigger_row_id: string | null;
  status: string;
  error: string | null;
  payload: unknown;
  ran_at: string;
};

export async function fetchWorkflows(subAccountId: string): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from("workflows")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Workflow[];
}

export async function fetchWorkflowRuns(subAccountId: string): Promise<WorkflowRun[]> {
  const { data, error } = await supabase
    .from("workflow_runs")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("ran_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as WorkflowRun[];
}

export type WorkflowInput = {
  name: string;
  enabled: boolean;
  trigger_type: WorkflowTrigger;
  trigger_config: Record<string, unknown>;
  actions: WorkflowAction[];
};

export async function createWorkflow(input: WorkflowInput, createdBy: string, subAccountId: string) {
  const { data, error } = await supabase
    .from("workflows")
    .insert({
      ...input,
      sub_account_id: subAccountId,
      created_by: createdBy,
      actions: input.actions as unknown as never,
      trigger_config: input.trigger_config as unknown as never,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Workflow;
}

export async function updateWorkflow(id: string, input: Partial<WorkflowInput>) {
  const patch: Record<string, unknown> = { ...input };
  if (input.actions) patch.actions = input.actions;
  if (input.trigger_config) patch.trigger_config = input.trigger_config;
  const { data, error } = await supabase
    .from("workflows")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Workflow;
}

export async function deleteWorkflow(id: string) {
  const { error } = await supabase.from("workflows").delete().eq("id", id);
  if (error) throw error;
}
