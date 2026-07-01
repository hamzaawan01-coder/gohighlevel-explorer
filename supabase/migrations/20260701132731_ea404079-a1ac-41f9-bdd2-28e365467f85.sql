
CREATE TABLE public.outbound_message_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.outbound_messages(id) ON DELETE CASCADE,
  sub_account_id UUID NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  attempt INTEGER NOT NULL,
  status TEXT NOT NULL,
  provider TEXT,
  provider_message_id TEXT,
  error TEXT,
  error_code TEXT,
  retryable BOOLEAN,
  latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX outbound_message_logs_message_id_idx ON public.outbound_message_logs(message_id, attempt);
CREATE INDEX outbound_message_logs_sub_account_id_idx ON public.outbound_message_logs(sub_account_id, created_at DESC);

GRANT SELECT ON public.outbound_message_logs TO authenticated;
GRANT ALL ON public.outbound_message_logs TO service_role;

ALTER TABLE public.outbound_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view outbound logs in their workspaces"
  ON public.outbound_message_logs FOR SELECT
  TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));
