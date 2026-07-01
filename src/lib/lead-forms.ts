import { supabase } from "@/integrations/supabase/client";

export type FormFieldType = "text" | "email" | "phone" | "textarea" | "select";

export type FormField = {
  key: string; // maps to contact col if 'email'|'first_name'|'last_name'|'phone'|'company'; else stored in payload
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select
};

export type LeadForm = {
  id: string;
  sub_account_id: string;
  owner_id: string;
  slug: string;
  name: string;
  description: string | null;
  fields: FormField[];
  success_message: string;
  redirect_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type FormSubmission = {
  id: string;
  form_id: string;
  sub_account_id: string;
  contact_id: string | null;
  payload: Record<string, string>;
  source_url: string | null;
  created_at: string;
};

export const CONTACT_FIELD_KEYS = new Set(["email", "first_name", "last_name", "phone", "company"]);

export const DEFAULT_FIELDS: FormField[] = [
  { key: "first_name", label: "First name", type: "text", required: false },
  { key: "last_name", label: "Last name", type: "text", required: false },
  { key: "email", label: "Email", type: "email", required: true },
  { key: "phone", label: "Phone", type: "phone", required: false },
  { key: "message", label: "Message", type: "textarea", required: false },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function fetchForms(subAccountId: string): Promise<LeadForm[]> {
  const { data, error } = await supabase
    .from("lead_forms")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as LeadForm[];
}

export async function fetchForm(id: string): Promise<LeadForm> {
  const { data, error } = await supabase.from("lead_forms").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as LeadForm;
}

export async function fetchFormBySlug(slug: string): Promise<LeadForm | null> {
  const { data, error } = await supabase
    .from("lead_forms")
    .select("*")
    .eq("slug", slug)
    .eq("enabled", true)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as LeadForm) ?? null;
}

export async function createForm(input: {
  name: string;
  description?: string | null;
  subAccountId: string;
  ownerId: string;
}): Promise<LeadForm> {
  const base = slugify(input.name) || "form";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("lead_forms")
    .insert({
      name: input.name,
      description: input.description ?? null,
      sub_account_id: input.subAccountId,
      owner_id: input.ownerId,
      slug,
      fields: DEFAULT_FIELDS as unknown as never,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as LeadForm;
}

export async function updateForm(
  id: string,
  patch: Partial<Pick<LeadForm, "name" | "description" | "fields" | "success_message" | "redirect_url" | "enabled">>,
): Promise<LeadForm> {
  const { data, error } = await supabase
    .from("lead_forms")
    .update(patch as unknown as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as LeadForm;
}

export async function deleteForm(id: string): Promise<void> {
  const { error } = await supabase.from("lead_forms").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchSubmissions(formId: string): Promise<FormSubmission[]> {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("form_id", formId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as FormSubmission[];
}

/** Submits a form via the public server route (works when signed out). */
export async function submitForm(slug: string, payload: Record<string, string>): Promise<void> {
  const res = await fetch(`/api/public/forms/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, source_url: typeof window !== "undefined" ? window.location.href : null }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "Submission failed");
    throw new Error(text || "Submission failed");
  }
}
