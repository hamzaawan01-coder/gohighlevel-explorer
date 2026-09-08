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

export type ConversationStatus = "open" | "pending" | "closed";

export type Conversation = {
  id: string;
  sub_account_id: string;
  contact_id: string;
  channel: MessageChannel;
  last_message_at: string | null;
  assigned_to_user_id: string | null;
  status: ConversationStatus;
  snoozed_until: string | null;
  last_read_at: string | null;
  priority: boolean;
  created_at: string;
  updated_at: string;
};

export const CONVERSATION_STATUSES: { key: ConversationStatus; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "pending", label: "Pending" },
  { key: "closed", label: "Closed" },
];

/** True when the last inbound activity happened after the viewer last read it. */
export function isUnread(c: Conversation): boolean {
  if (!c.last_message_at) return false;
  if (!c.last_read_at) return true;
  return new Date(c.last_message_at).getTime() > new Date(c.last_read_at).getTime();
}

export type ConversationFilters = {
  channel?: "all" | MessageChannel;
  status?: "all" | ConversationStatus;
  assignee?: "all" | "mine" | "unassigned";
  currentUserId?: string | null;
};

/** Pure inbox filtering, shared by the UI and unit tests. */
export function filterConversations(
  rows: Conversation[],
  f: ConversationFilters,
): Conversation[] {
  return rows.filter((c) => {
    if (f.channel && f.channel !== "all" && c.channel !== f.channel) return false;
    if (f.status && f.status !== "all" && (c.status ?? "open") !== f.status) return false;
    if (f.assignee === "mine" && c.assigned_to_user_id !== f.currentUserId) return false;
    if (f.assignee === "unassigned" && c.assigned_to_user_id) return false;
    return true;
  });
}

export async function updateConversation(
  id: string,
  patch: Partial<
    Pick<Conversation, "assigned_to_user_id" | "status" | "priority" | "snoozed_until" | "last_read_at">
  >,
): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function markConversationRead(id: string): Promise<void> {
  await updateConversation(id, { last_read_at: new Date().toISOString() });
}

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
  // Always derive the workspace from the contact itself: the selected workspace in
  // the switcher can be stale or belong to a different workspace than the contact,
  // which would fail the row-level security check on insert.
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("sub_account_id")
    .eq("id", contactId)
    .maybeSingle();
  if (contactError) throw contactError;
  const owningSubId = (contact?.sub_account_id as string | undefined) ?? subAccountId;
  const { data, error } = await supabase
    .from("conversations")
    .insert({ sub_account_id: owningSubId, contact_id: contactId, channel })
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
