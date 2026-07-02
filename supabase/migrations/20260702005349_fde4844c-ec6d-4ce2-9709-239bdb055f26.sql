
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_urls text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS from_number text,
  ADD COLUMN IF NOT EXISTS to_number text,
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS twilio_number_id uuid REFERENCES public.twilio_numbers(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_uidx
  ON public.messages(sub_account_id, external_id)
  WHERE external_id IS NOT NULL;
