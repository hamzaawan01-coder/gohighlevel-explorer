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

export type IntegrationRow = {
  sub_account_id: string;
  email_provider: EmailProvider | null;
  email_config: Record<string, unknown>;
  email_from_address: string | null;
  email_from_name: string | null;
  email_verified_at: string | null;
  sms_provider: "twilio" | null;
  sms_config: Record<string, unknown>;
  sms_from_number: string | null;
  sms_verified_at: string | null;
  updated_at: string;
};

export async function fetchIntegrations(subAccountId: string): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("sub_account_integrations")
    .select("*")
    .eq("sub_account_id", subAccountId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as IntegrationRow | null;
}

export async function saveEmailIntegration(input: {
  sub_account_id: string;
  provider: EmailProvider;
  config: SmtpConfig | ResendConfig | SendGridConfig;
  from_address: string;
  from_name?: string;
}) {
  const { error } = await supabase
    .from("sub_account_integrations")
    .upsert(
      {
        sub_account_id: input.sub_account_id,
        email_provider: input.provider,
        email_config: input.config as never,
        email_from_address: input.from_address,
        email_from_name: input.from_name ?? null,
      },
      { onConflict: "sub_account_id" },
    );
  if (error) throw error;
}

export async function saveSmsIntegration(input: {
  sub_account_id: string;
  config: TwilioConfig;
  from_number: string;
}) {
  const { error } = await supabase
    .from("sub_account_integrations")
    .upsert(
      {
        sub_account_id: input.sub_account_id,
        sms_provider: "twilio",
        sms_config: input.config as never,
        sms_from_number: input.from_number,
      },
      { onConflict: "sub_account_id" },
    );
  if (error) throw error;
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
