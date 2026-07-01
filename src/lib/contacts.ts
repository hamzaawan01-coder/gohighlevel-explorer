import { supabase } from "@/integrations/supabase/client";

export type LifecycleStage = "lead" | "mql" | "sql" | "customer" | "lost";

export const LIFECYCLE_STAGES: { value: LifecycleStage; label: string }[] = [
  { value: "lead", label: "Lead" },
  { value: "mql", label: "MQL" },
  { value: "sql", label: "SQL" },
  { value: "customer", label: "Customer" },
  { value: "lost", label: "Lost" },
];

export type Contact = {
  id: string;
  owner_id: string;
  sub_account_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  notes: string | null;
  lifecycle_stage: LifecycleStage;
  lead_source: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchContacts(subAccountId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function fetchContact(id: string): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Contact;
}

export type ContactInput = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  tags?: string[];
  notes?: string | null;
  lifecycle_stage?: LifecycleStage;
  lead_source?: string | null;
};

export async function createContact(
  input: ContactInput,
  ownerId: string,
  subAccountId: string,
) {
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      ...input,
      owner_id: ownerId,
      sub_account_id: subAccountId,
      tags: input.tags ?? [],
      lifecycle_stage: input.lifecycle_stage ?? "lead",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function updateContact(id: string, input: ContactInput) {
  const { data, error } = await supabase
    .from("contacts")
    .update({ ...input })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Contact;
}

export async function deleteContact(id: string) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}
