import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export type Task = {
  id: string;
  sub_account_id: string;
  created_by: string;
  assigned_to: string | null;
  contact_id: string | null;
  deal_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskInput = {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_at?: string | null;
  assigned_to?: string | null;
  contact_id?: string | null;
  deal_id?: string | null;
};

export async function fetchTasks(subAccountId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Task[];
}

export async function createTask(
  input: TaskInput,
  createdBy: string,
  subAccountId: string,
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      sub_account_id: subAccountId,
      created_by: createdBy,
      status: input.status ?? "open",
      priority: input.priority ?? "medium",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTask(id: string, input: Partial<TaskInput>): Promise<Task> {
  const patch: Record<string, unknown> = { ...input };
  if (input.status === "done") patch.completed_at = new Date().toISOString();
  if (input.status && input.status !== "done") patch.completed_at = null;
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
