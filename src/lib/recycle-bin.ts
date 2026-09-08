import { supabase } from "@/integrations/supabase/client";

/** Record types that can be recovered from the recycle bin. */
export type RecycleEntity = "contacts" | "deals" | "tasks" | "invoices";

export const RECYCLE_LABELS: Record<RecycleEntity, string> = {
  contacts: "Contact",
  deals: "Opportunity",
  tasks: "Task",
  invoices: "Invoice",
};

export type RecycleItem = {
  entity: RecycleEntity;
  id: string;
  label: string;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_name: string | null;
};

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  }).rpc(name, args);

/** Move a record to the recycle bin instead of erasing it. */
export async function softDelete(entity: RecycleEntity, id: string): Promise<void> {
  const { error } = await rpc("recycle_bin_soft_delete", { _entity: entity, _id: id });
  if (error) throw error;
}

/** Restore a record out of the recycle bin (admins/owners only). */
export async function restoreRecord(entity: RecycleEntity, id: string): Promise<void> {
  const { error } = await rpc("recycle_bin_restore", { _entity: entity, _id: id });
  if (error) throw error;
}

/** Permanently erase a record in the recycle bin (admins/owners only). */
export async function purgeRecord(entity: RecycleEntity, id: string): Promise<void> {
  const { error } = await rpc("recycle_bin_purge", { _entity: entity, _id: id });
  if (error) throw error;
}

/** Everything currently in this workspace's recycle bin. Empty for non-admins. */
export async function fetchRecycleBin(subAccountId: string): Promise<RecycleItem[]> {
  const { data, error } = await rpc("list_recycle_bin", { _sub: subAccountId });
  if (error) throw error;
  return (data ?? []) as RecycleItem[];
}
