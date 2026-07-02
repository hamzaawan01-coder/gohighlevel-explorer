
-- Phase 1: Twilio connections + owned numbers per sub-account

CREATE TABLE public.twilio_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  account_sid text NOT NULL,
  api_key_sid text NOT NULL,
  api_key_secret text NOT NULL,
  friendly_name text,
  status text NOT NULL DEFAULT 'active',
  webhook_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  twiml_app_sid text,
  last_verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.twilio_connections TO authenticated;
GRANT ALL ON public.twilio_connections TO service_role;

ALTER TABLE public.twilio_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read twilio connections"
  ON public.twilio_connections FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "admins manage twilio connections"
  ON public.twilio_connections FOR ALL TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE TRIGGER trg_twilio_connections_updated_at
  BEFORE UPDATE ON public.twilio_connections
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Owned Twilio phone numbers
CREATE TABLE public.twilio_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.twilio_connections(id) ON DELETE CASCADE,
  phone_number text NOT NULL,
  friendly_name text,
  twilio_sid text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  monthly_cost numeric(10,4),
  cost_currency text,
  iso_country text,
  voice_url text,
  sms_url text,
  status_callback text,
  is_default boolean NOT NULL DEFAULT false,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sub_account_id, phone_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.twilio_numbers TO authenticated;
GRANT ALL ON public.twilio_numbers TO service_role;

ALTER TABLE public.twilio_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read twilio numbers"
  ON public.twilio_numbers FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE POLICY "admins manage twilio numbers"
  ON public.twilio_numbers FOR ALL TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));

CREATE TRIGGER trg_twilio_numbers_updated_at
  BEFORE UPDATE ON public.twilio_numbers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_twilio_numbers_sub ON public.twilio_numbers(sub_account_id) WHERE released_at IS NULL;
