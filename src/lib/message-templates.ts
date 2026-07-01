import { supabase } from "@/integrations/supabase/client";

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

export type MessageTemplateInput = {
  name: string;
  channel: TemplateChannel;
  subject?: string | null;
  body_html?: string | null;
  body_text?: string | null;
};

export async function fetchMessageTemplates(subAccountId: string): Promise<MessageTemplate[]> {
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MessageTemplate[];
}

export async function createMessageTemplate(
  input: MessageTemplateInput,
  createdBy: string,
  subAccountId: string,
) {
  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      name: input.name,
      channel: input.channel,
      subject: input.subject ?? null,
      body_html: input.body_html ?? null,
      body_text: input.body_text ?? null,
      sub_account_id: subAccountId,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageTemplate;
}

export async function updateMessageTemplate(id: string, input: Partial<MessageTemplateInput>) {
  const { data, error } = await supabase
    .from("message_templates")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as MessageTemplate;
}

export async function deleteMessageTemplate(id: string) {
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) throw error;
}
