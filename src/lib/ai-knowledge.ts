import { supabase } from "@/integrations/supabase/client";

export type KnowledgeDoc = {
  id: string;
  sub_account_id: string;
  title: string;
  content: string;
  source_name: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export async function fetchKnowledgeDocs(subAccountId: string): Promise<KnowledgeDoc[]> {
  const { data, error } = await supabase
    .from("ai_knowledge_docs" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as KnowledgeDoc[];
}

export async function createKnowledgeDoc(input: {
  subAccountId: string;
  title: string;
  content: string;
  sourceName?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("ai_knowledge_docs" as never).insert({
    sub_account_id: input.subAccountId,
    title: input.title.trim() || "Untitled",
    content: input.content,
    source_name: input.sourceName ?? null,
  } as never);
  if (error) throw error;
}

export async function updateKnowledgeDoc(
  id: string,
  patch: Partial<Pick<KnowledgeDoc, "title" | "content" | "enabled">>,
): Promise<void> {
  const { error } = await supabase
    .from("ai_knowledge_docs" as never)
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteKnowledgeDoc(id: string): Promise<void> {
  const { error } = await supabase.from("ai_knowledge_docs" as never).delete().eq("id", id);
  if (error) throw error;
}

/** Text-like files we can read directly in the browser. */
export const KNOWLEDGE_ACCEPT = ".txt,.md,.markdown,.csv,.json,.html,text/plain";

export async function readTextFile(file: File): Promise<string> {
  const text = await file.text();
  return text.replace(/\u0000/g, "").trim();
}

export type DraftFeedback = {
  id: string;
  rating: "up" | "down";
  draft: string;
  note: string;
  channel: string | null;
  created_at: string;
};

export async function submitDraftFeedback(input: {
  subAccountId: string;
  conversationId: string | null;
  rating: "up" | "down";
  draft: string;
  note?: string;
  channel?: string | null;
}): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("ai_draft_feedback" as never).insert({
    sub_account_id: input.subAccountId,
    conversation_id: input.conversationId,
    user_id: auth.user?.id ?? null,
    rating: input.rating,
    draft: input.draft,
    note: input.note ?? "",
    channel: input.channel ?? null,
  } as never);
  if (error) throw error;
}

export async function fetchDraftFeedback(subAccountId: string, limit = 25): Promise<DraftFeedback[]> {
  const { data, error } = await supabase
    .from("ai_draft_feedback" as never)
    .select("id, rating, draft, note, channel, created_at")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as DraftFeedback[];
}
