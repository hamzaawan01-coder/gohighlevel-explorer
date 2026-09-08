CREATE TABLE public.forwarded_mailboxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  address TEXT NOT NULL,
  display_name TEXT,
  inbound_token TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  last_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE public.forwarded_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mailbox_id UUID NOT NULL REFERENCES public.forwarded_mailboxes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  folder TEXT NOT NULL DEFAULT 'inbox',
  from_address TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  to_address TEXT NOT NULL DEFAULT '',
  cc_address TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  snippet TEXT NOT NULL DEFAULT '',
  body_text TEXT,
  body_html TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  unread BOOLEAN NOT NULL DEFAULT true,
  starred BOOLEAN NOT NULL DEFAULT false,
  thread_key TEXT NOT NULL DEFAULT '',
  provider_message_id TEXT,
  in_reply_to TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX forwarded_messages_mailbox_folder_idx
  ON public.forwarded_messages (mailbox_id, folder, received_at DESC);
CREATE UNIQUE INDEX forwarded_messages_dedupe_idx
  ON public.forwarded_messages (mailbox_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forwarded_mailboxes TO authenticated;
GRANT ALL ON public.forwarded_mailboxes TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.forwarded_messages TO authenticated;
GRANT ALL ON public.forwarded_messages TO service_role;

ALTER TABLE public.forwarded_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarded_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own forwarding mailbox"
  ON public.forwarded_mailboxes FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read their own forwarded mail"
  ON public.forwarded_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users update their own forwarded mail"
  ON public.forwarded_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete their own forwarded mail"
  ON public.forwarded_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.forwarded_mailboxes_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.forwarded_mailboxes_touch() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER forwarded_mailboxes_updated_at
  BEFORE UPDATE ON public.forwarded_mailboxes
  FOR EACH ROW EXECUTE FUNCTION public.forwarded_mailboxes_touch();