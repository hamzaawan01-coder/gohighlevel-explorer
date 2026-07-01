
DO $$ BEGIN
  CREATE TYPE public.message_channel AS ENUM ('note','email','sms','whatsapp','instagram','messenger','linkedin','tiktok');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.message_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS channel public.message_channel NOT NULL DEFAULT 'note',
  ADD COLUMN IF NOT EXISTS direction public.message_direction NOT NULL DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS sender_handle text;

UPDATE public.messages SET channel = 'email' WHERE kind = 'email_log' AND channel = 'note';
UPDATE public.messages SET channel = 'sms'   WHERE kind = 'sms_log'   AND channel = 'note';

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS channel public.message_channel NOT NULL DEFAULT 'note';

CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(conversation_id, channel);
CREATE INDEX IF NOT EXISTS idx_conversations_channel ON public.conversations(sub_account_id, channel);
