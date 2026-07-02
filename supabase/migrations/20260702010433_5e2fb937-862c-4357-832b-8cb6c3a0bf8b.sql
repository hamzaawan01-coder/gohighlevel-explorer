
ALTER TABLE public.twilio_numbers
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sender text,
  ADD COLUMN IF NOT EXISTS whatsapp_url text;
