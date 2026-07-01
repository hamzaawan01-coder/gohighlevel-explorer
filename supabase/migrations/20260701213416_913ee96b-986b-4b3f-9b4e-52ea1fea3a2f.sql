
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS external_thread_id text;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_sub_thread_uidx
  ON public.conversations (sub_account_id, external_thread_id) WHERE external_thread_id IS NOT NULL;

ALTER TYPE public.message_kind ADD VALUE IF NOT EXISTS 'messenger_log';
ALTER TYPE public.message_kind ADD VALUE IF NOT EXISTS 'instagram_log';
