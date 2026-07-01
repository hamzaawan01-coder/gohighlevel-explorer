import { supabase } from "@/integrations/supabase/client";

export type Conversation = {
  id: string;
  sub_account_id: string;
  contact_id: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sub_account_id: string;
  author_user_id: string | null;
  kind: "note" | "email_log" | "sms_log";
  body: string;
  created_at: string;
};

export async function fetchConversations(subAccountId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as Conversation[];
}

/** Get or create a conversation for a contact. */
export async function ensureConversation(subAccountId: string, contactId: string): Promise<Conversation> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("contact_id", contactId)
    .maybeSingle();
  if (existing) return existing as Conversation;
  const { data, error } = await supabase
    .from("conversations")
    .insert({ sub_account_id: subAccountId, contact_id: contactId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Conversation;
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function postNote(input: {
  conversation_id: string;
  sub_account_id: string;
  author_user_id: string;
  body: string;
}): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ ...input, kind: "note" })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}
