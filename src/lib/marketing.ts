import { supabase } from "@/integrations/supabase/client";

// -------------------- Templates --------------------
export type TemplateChannel = "email" | "sms";

export type MessageTemplate = {
  id: string;
  sub_account_id: string;
  created_by: string;
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchTemplates(subAccountId: string): Promise<MessageTemplate[]> {
  const { data, error } = await supabase
    .from("message_templates" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MessageTemplate[];
}

export async function upsertTemplate(input: Partial<MessageTemplate> & { sub_account_id: string; created_by: string; name: string; channel: TemplateChannel }) {
  const { data, error } = await supabase
    .from("message_templates" as never)
    .upsert(input as never, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as MessageTemplate;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase.from("message_templates" as never).delete().eq("id", id);
  if (error) throw error;
}

// -------------------- Campaigns --------------------
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export type CampaignSegment = {
  tags?: string[];
  stage?: string;
  has_email?: boolean;
  has_phone?: boolean;
};

export type Campaign = {
  id: string;
  sub_account_id: string;
  created_by: string;
  name: string;
  channel: TemplateChannel;
  template_id: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  segment: CampaignSegment;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
};

export async function fetchCampaigns(subAccountId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("campaigns" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Campaign[];
}

export async function upsertCampaign(input: Partial<Campaign> & { sub_account_id: string; created_by: string; name: string; channel: TemplateChannel }) {
  const { data, error } = await supabase
    .from("campaigns" as never)
    .upsert(input as never, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as Campaign;
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from("campaigns" as never).delete().eq("id", id);
  if (error) throw error;
}

// -------------------- Trigger links --------------------
export type TriggerLink = {
  id: string;
  sub_account_id: string;
  created_by: string;
  slug: string;
  name: string;
  target_url: string;
  click_count: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchTriggerLinks(subAccountId: string): Promise<TriggerLink[]> {
  const { data, error } = await supabase
    .from("trigger_links" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TriggerLink[];
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

export async function createTriggerLink(input: { name: string; target_url: string; sub_account_id: string; created_by: string }) {
  const base = slugify(input.name) || "link";
  const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase
    .from("trigger_links" as never)
    .insert({ ...input, slug } as never)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as TriggerLink;
}

export async function updateTriggerLink(id: string, patch: Partial<TriggerLink>) {
  const { data, error } = await supabase
    .from("trigger_links" as never)
    .update(patch as never)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as TriggerLink;
}

export async function deleteTriggerLink(id: string) {
  const { error } = await supabase.from("trigger_links" as never).delete().eq("id", id);
  if (error) throw error;
}

// -------------------- Social posts --------------------
export type SocialPlatform = "facebook" | "instagram" | "linkedin" | "twitter";
export type SocialPostStatus = "draft" | "scheduled" | "published" | "failed";

export type SocialPost = {
  id: string;
  sub_account_id: string;
  created_by: string;
  platform: SocialPlatform;
  content: string;
  media_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: SocialPostStatus;
  external_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchSocialPosts(subAccountId: string): Promise<SocialPost[]> {
  const { data, error } = await supabase
    .from("social_posts" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("scheduled_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as SocialPost[];
}

export async function upsertSocialPost(input: Partial<SocialPost> & { sub_account_id: string; created_by: string; platform: SocialPlatform; content: string }) {
  const { data, error } = await supabase
    .from("social_posts" as never)
    .upsert(input as never, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as SocialPost;
}

export async function deleteSocialPost(id: string) {
  const { error } = await supabase.from("social_posts" as never).delete().eq("id", id);
  if (error) throw error;
}

// -------------------- Ad campaigns --------------------
export type AdPlatform = "google" | "meta" | "linkedin" | "tiktok" | "other";
export type AdCampaignStatus = "draft" | "active" | "paused" | "completed";

export type AdCampaign = {
  id: string;
  sub_account_id: string;
  created_by: string;
  name: string;
  platform: AdPlatform;
  status: AdCampaignStatus;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchAdCampaigns(subAccountId: string): Promise<AdCampaign[]> {
  const { data, error } = await supabase
    .from("ad_campaigns" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AdCampaign[];
}

export async function upsertAdCampaign(input: Partial<AdCampaign> & { sub_account_id: string; created_by: string; name: string; platform: AdPlatform }) {
  const { data, error } = await supabase
    .from("ad_campaigns" as never)
    .upsert(input as never, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as AdCampaign;
}

export async function deleteAdCampaign(id: string) {
  const { error } = await supabase.from("ad_campaigns" as never).delete().eq("id", id);
  if (error) throw error;
}
