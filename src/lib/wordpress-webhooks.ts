import { supabase } from "@/integrations/supabase/client";

export type WordPressWebhook = {
  id: string;
  sub_account_id: string;
  form_id: string;
  created_by: string;
  name: string;
  token: string;
  secret: string | null;
  field_map: Record<string, string[]>;
  default_tags: string[];
  lead_source: string;
  enabled: boolean;
  total_received: number;
  last_received_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fetchWebhooks(subAccountId: string): Promise<WordPressWebhook[]> {
  const { data, error } = await supabase
    .from("wordpress_webhooks")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as WordPressWebhook[];
}

export async function createWebhook(input: {
  name: string;
  subAccountId: string;
  ownerId: string;
  generateSecret: boolean;
}): Promise<WordPressWebhook> {
  // 1. Create a lead_form to catch the submissions.
  const slug = `wp-${Math.random().toString(36).slice(2, 8)}`;
  const { data: form, error: fErr } = await supabase
    .from("lead_forms")
    .insert({
      name: `WordPress: ${input.name}`,
      description: "Submissions received from WordPress via webhook",
      sub_account_id: input.subAccountId,
      owner_id: input.ownerId,
      slug,
      fields: [] as never,
      enabled: false, // not a public embeddable form
    })
    .select("id")
    .single();
  if (fErr) throw fErr;

  const token = randomToken();
  const secret = input.generateSecret ? randomToken(32) : null;

  const { data, error } = await supabase
    .from("wordpress_webhooks")
    .insert({
      name: input.name,
      sub_account_id: input.subAccountId,
      created_by: input.ownerId,
      form_id: form.id,
      token,
      secret,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as WordPressWebhook;
}

export async function updateWebhook(
  id: string,
  patch: Partial<
    Pick<WordPressWebhook, "name" | "enabled" | "field_map" | "default_tags" | "lead_source" | "secret">
  >,
): Promise<WordPressWebhook> {
  const { data, error } = await supabase
    .from("wordpress_webhooks")
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as WordPressWebhook;
}

export async function deleteWebhook(id: string): Promise<void> {
  const { error } = await supabase.from("wordpress_webhooks").delete().eq("id", id);
  if (error) throw error;
}

export function webhookUrl(token: string): string {
  const previewOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const origin = previewOrigin.includes("lovable.app")
    ? "https://gohighlevel-explorer.lovable.app"
    : previewOrigin;
  return `${origin}/api/public/hooks/wordpress/${token}`;
}
