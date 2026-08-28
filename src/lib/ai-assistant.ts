import { supabase } from "@/integrations/supabase/client";

export type AiAssistantSettings = {
  id?: string;
  sub_account_id: string;
  enabled: boolean;
  business_info: string;
  tone: string;
  extra_instructions: string;
  signature: string;
  use_contact_context: boolean;
  use_deal_context: boolean;
  offer_booking_link: boolean;
  booking_page_id: string | null;
  suggest_escalation: boolean;
};

export const TONE_OPTIONS = [
  "friendly and professional",
  "warm and conversational",
  "short and direct",
  "formal and precise",
];

export function defaultAiSettings(subAccountId: string): AiAssistantSettings {
  return {
    sub_account_id: subAccountId,
    enabled: true,
    business_info: "",
    tone: TONE_OPTIONS[0],
    extra_instructions: "",
    signature: "",
    use_contact_context: true,
    use_deal_context: true,
    offer_booking_link: true,
    booking_page_id: null,
    suggest_escalation: true,
  };
}

export async function fetchAiSettings(subAccountId: string): Promise<AiAssistantSettings> {
  const { data, error } = await supabase
    .from("ai_assistant_settings" as never)
    .select("*")
    .eq("sub_account_id", subAccountId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return defaultAiSettings(subAccountId);
  return data as unknown as AiAssistantSettings;
}

export async function saveAiSettings(s: AiAssistantSettings): Promise<void> {
  const { error } = await supabase
    .from("ai_assistant_settings" as never)
    .upsert(
      {
        sub_account_id: s.sub_account_id,
        enabled: s.enabled,
        business_info: s.business_info,
        tone: s.tone,
        extra_instructions: s.extra_instructions,
        signature: s.signature,
        use_contact_context: s.use_contact_context,
        use_deal_context: s.use_deal_context,
        offer_booking_link: s.offer_booking_link,
        booking_page_id: s.booking_page_id,
        suggest_escalation: s.suggest_escalation,
      } as never,
      { onConflict: "sub_account_id" },
    );
  if (error) throw error;
}
