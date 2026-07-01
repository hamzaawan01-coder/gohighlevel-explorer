import { supabase } from "@/integrations/supabase/client";

export type MessageChannel =
  | "note"
  | "email"
  | "sms"
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "linkedin"
  | "tiktok";

export type MessageDirection = "inbound" | "outbound";

export type Conversation = {
  id: string;
  sub_account_id: string;
  contact_id: string;
  channel: MessageChannel;
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
  channel: MessageChannel;
  direction: MessageDirection;
  external_id: string | null;
  sender_handle: string | null;
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

/** Get or create a conversation for a contact + channel. */
export async function ensureConversation(
  subAccountId: string,
  contactId: string,
  channel: MessageChannel = "note",
): Promise<Conversation> {
  const { data: existing } = await supabase
    .from("conversations")
    .select("*")
    .eq("contact_id", contactId)
    .eq("channel", channel)
    .maybeSingle();
  if (existing) return existing as Conversation;
  const { data, error } = await supabase
    .from("conversations")
    .insert({ sub_account_id: subAccountId, contact_id: contactId, channel })
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

export async function postMessage(input: {
  conversation_id: string;
  sub_account_id: string;
  author_user_id: string;
  body: string;
  channel: MessageChannel;
  direction?: MessageDirection;
}): Promise<Message> {
  const channel = input.channel;
  const kind: Message["kind"] =
    channel === "email" ? "email_log" : channel === "sms" ? "sms_log" : "note";
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversation_id,
      sub_account_id: input.sub_account_id,
      author_user_id: input.author_user_id,
      body: input.body,
      channel,
      direction: input.direction ?? "outbound",
      kind,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

/** @deprecated Use postMessage with channel: "note". */
export const postNote = (input: {
  conversation_id: string;
  sub_account_id: string;
  author_user_id: string;
  body: string;
}) => postMessage({ ...input, channel: "note" });
