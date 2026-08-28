CREATE TABLE public.ai_draft_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating text NOT NULL CHECK (rating IN ('up','down')),
  draft text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  channel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_draft_feedback TO authenticated;
GRANT ALL ON public.ai_draft_feedback TO service_role;
ALTER TABLE public.ai_draft_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_draft_feedback_sub_access" ON public.ai_draft_feedback
  FOR ALL TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE INDEX ai_draft_feedback_sub_idx ON public.ai_draft_feedback(sub_account_id, created_at DESC);

CREATE TRIGGER ai_draft_feedback_updated_at
  BEFORE UPDATE ON public.ai_draft_feedback
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.ai_knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  content text NOT NULL DEFAULT '',
  source_name text,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_knowledge_docs TO authenticated;
GRANT ALL ON public.ai_knowledge_docs TO service_role;
ALTER TABLE public.ai_knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_knowledge_docs_sub_access" ON public.ai_knowledge_docs
  FOR ALL TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id))
  WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE INDEX ai_knowledge_docs_sub_idx ON public.ai_knowledge_docs(sub_account_id, updated_at DESC);

CREATE TRIGGER ai_knowledge_docs_updated_at
  BEFORE UPDATE ON public.ai_knowledge_docs
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();