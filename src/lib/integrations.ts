import { supabase } from "@/integrations/supabase/client";

export type EmailProvider = "smtp" | "resend" | "sendgrid";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
};

export type ResendConfig = { api_key: string };
export type SendGridConfig = { api_key: string };

export type TwilioConfig = {
  account_sid: string;
  auth_token: string;
};

export type TextMagicConfig = {
  username: string;
  api_key: string;
};

export type SmsProvider = "twilio" | "twilio_connector" | "textmagic";

/**
 * Non-secret integration settings. Provider credentials (email_config /
 * sms_config) are intentionally NOT part of this row — they are write-only from
 * the client and only readable server-side.
 */
export type IntegrationRow = {
  sub_account_id: string;
  email_provider: EmailProvider | null;
  email_from_address: string | null;
  email_from_name: string | null;
  email_verified_at: string | null;
  sms_provider: SmsProvider | null;
  sms_from_number: string | null;
  sms_verified_at: string | null;
  updated_at: string;
};

const SAFE_COLUMNS =
  "sub_account_id, email_provider, email_from_address, email_from_name, email_verified_at, sms_provider, sms_from_number, sms_verified_at, updated_at";

export async function fetchIntegrations(subAccountId: string): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("sub_account_integrations")
    .select(SAFE_COLUMNS)
    .eq("sub_account_id", subAccountId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as IntegrationRow | null;
}


export type OutboundMessage = {
  id: string;
  sub_account_id: string;
  channel: "email" | "sms";
  status: "queued" | "sending" | "sent" | "failed";
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  provider: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  sent_at: string | null;
};

export async function fetchOutbound(subAccountId: string): Promise<OutboundMessage[]> {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as OutboundMessage[];
}
