
-- Phase 3: Voice, IVR, recordings, voicemail

ALTER TABLE public.twilio_connections
  ADD COLUMN IF NOT EXISTS twiml_app_sid text,
  ADD COLUMN IF NOT EXISTS voice_identity_prefix text;

-- Call flows (IVR JSON)
CREATE TABLE IF NOT EXISTS public.phone_call_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  twilio_number_id uuid REFERENCES public.twilio_numbers(id) ON DELETE SET NULL,
  name text NOT NULL,
  greeting_text text,
  greeting_audio_url text,
  voice_language text DEFAULT 'en-US',
  voice_gender text DEFAULT 'alice',
  menu jsonb NOT NULL DEFAULT '{"options":[]}'::jsonb,
  ring_agent_ids uuid[] DEFAULT '{}',
  ring_timeout_seconds int DEFAULT 20,
  voicemail_enabled boolean DEFAULT true,
  voicemail_prompt text DEFAULT 'Please leave a message after the tone.',
  is_default boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_call_flows TO authenticated;
GRANT ALL ON public.phone_call_flows TO service_role;
ALTER TABLE public.phone_call_flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read call flows" ON public.phone_call_flows FOR SELECT
  TO authenticated USING (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE POLICY "admins write call flows" ON public.phone_call_flows FOR ALL
  TO authenticated USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));
CREATE TRIGGER trg_call_flows_updated_at BEFORE UPDATE ON public.phone_call_flows
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Phone call log
CREATE TABLE IF NOT EXISTS public.phone_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  twilio_number_id uuid REFERENCES public.twilio_numbers(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  agent_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_number text,
  to_number text,
  call_sid text UNIQUE,
  parent_call_sid text,
  status text,
  duration_seconds int,
  recording_url text,
  recording_sid text,
  recording_duration int,
  transcript text,
  transcript_status text,
  price numeric,
  price_currency text,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_calls TO authenticated;
GRANT ALL ON public.phone_calls TO service_role;
ALTER TABLE public.phone_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read phone calls" ON public.phone_calls FOR SELECT
  TO authenticated USING (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE POLICY "members insert phone calls" ON public.phone_calls FOR INSERT
  TO authenticated WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE POLICY "members update phone calls" ON public.phone_calls FOR UPDATE
  TO authenticated USING (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE TRIGGER trg_phone_calls_updated_at BEFORE UPDATE ON public.phone_calls
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_phone_calls_sub_started ON public.phone_calls(sub_account_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_phone_calls_contact ON public.phone_calls(contact_id);

-- Voicemails
CREATE TABLE IF NOT EXISTS public.voicemails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  phone_call_id uuid REFERENCES public.phone_calls(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  twilio_number_id uuid REFERENCES public.twilio_numbers(id) ON DELETE SET NULL,
  from_number text,
  recording_url text NOT NULL,
  recording_sid text UNIQUE,
  duration_seconds int,
  transcription text,
  transcription_status text,
  listened_at timestamptz,
  listened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voicemails TO authenticated;
GRANT ALL ON public.voicemails TO service_role;
ALTER TABLE public.voicemails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read voicemails" ON public.voicemails FOR SELECT
  TO authenticated USING (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE POLICY "members update voicemails" ON public.voicemails FOR UPDATE
  TO authenticated USING (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE TRIGGER trg_voicemails_updated_at BEFORE UPDATE ON public.voicemails
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_voicemails_sub_created ON public.voicemails(sub_account_id, created_at DESC);
