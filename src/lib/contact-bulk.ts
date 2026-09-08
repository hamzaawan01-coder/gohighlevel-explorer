import { supabase } from "@/integrations/supabase/client";
import type { LifecycleStage } from "@/lib/contacts";

/* ---------- Bulk actions ---------- */

export async function bulkUpdateStage(ids: string[], stage: LifecycleStage) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("contacts")
    .update({ lifecycle_stage: stage })
    .in("id", ids);
  if (error) throw error;
}

export async function bulkDeleteContacts(ids: string[]) {
  if (ids.length === 0) return;
  const { softDelete } = await import("@/lib/recycle-bin");
  for (const id of ids) await softDelete("contacts", id);
}

/** Add a tag to a set of contacts, preserving existing tags per row. */
export async function bulkAddTag(ids: string[], tag: string) {
  if (ids.length === 0 || !tag.trim()) return;
  const clean = tag.trim();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, tags")
    .in("id", ids);
  if (error) throw error;
  await Promise.all(
    (data ?? []).map((row) => {
      const tags = new Set([...(row.tags ?? []), clean]);
      return supabase
        .from("contacts")
        .update({ tags: Array.from(tags) })
        .eq("id", row.id);
    }),
  );
}

export async function bulkRemoveTag(ids: string[], tag: string) {
  if (ids.length === 0 || !tag) return;
  const { data, error } = await supabase
    .from("contacts")
    .select("id, tags")
    .in("id", ids);
  if (error) throw error;
  await Promise.all(
    (data ?? []).map((row) =>
      supabase
        .from("contacts")
        .update({ tags: (row.tags ?? []).filter((t: string) => t !== tag) })
        .eq("id", row.id),
    ),
  );
}

/* ---------- Saved views ---------- */

export type ContactViewFilters = {
  search?: string;
  stage?: LifecycleStage | "all";
  tag?: string | null;
};

export type ContactView = {
  id: string;
  sub_account_id: string;
  owner_id: string;
  name: string;
  filters: ContactViewFilters;
  created_at: string;
  updated_at: string;
};

export async function fetchContactViews(subAccountId: string): Promise<ContactView[]> {
  const { data, error } = await supabase
    .from("contact_views")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContactView[];
}

export async function createContactView(params: {
  name: string;
  filters: ContactViewFilters;
  subAccountId: string;
  ownerId: string;
}): Promise<ContactView> {
  const { data, error } = await supabase
    .from("contact_views")
    .insert({
      name: params.name,
      filters: params.filters,
      sub_account_id: params.subAccountId,
      owner_id: params.ownerId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as ContactView;
}

export async function deleteContactView(id: string) {
  const { error } = await supabase.from("contact_views").delete().eq("id", id);
  if (error) throw error;
}
