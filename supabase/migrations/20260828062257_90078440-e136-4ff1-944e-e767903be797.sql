CREATE TABLE public.ai_assistant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL UNIQUE REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  business_info text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'friendly and professional',
  extra_instructions text NOT NULL DEFAULT '',
  signature text NOT NULL DEFAULT '',
  use_contact_context boolean NOT NULL DEFAULT true,
  use_deal_context boolean NOT NULL DEFAULT true,
  offer_booking_link boolean NOT NULL DEFAULT true,
  booking_page_id uuid REFERENCES public.booking_pages(id) ON DELETE SET NULL,
  suggest_escalation boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_assistant_settings TO authenticated;
GRANT ALL ON public.ai_assistant_settings TO service_role;

ALTER TABLE public.ai_assistant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read ai assistant settings"
  ON public.ai_assistant_settings FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "Admins manage ai assistant settings"
  ON public.ai_assistant_settings FOR ALL TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE TRIGGER ai_assistant_settings_updated_at
  BEFORE UPDATE ON public.ai_assistant_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();