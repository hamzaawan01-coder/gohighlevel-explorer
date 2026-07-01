
CREATE TABLE public.booking_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  duration_minutes int NOT NULL DEFAULT 30,
  buffer_minutes int NOT NULL DEFAULT 0,
  advance_days int NOT NULL DEFAULT 14,
  min_notice_minutes int NOT NULL DEFAULT 60,
  timezone text NOT NULL DEFAULT 'UTC',
  availability jsonb NOT NULL DEFAULT '{"mon":[{"start":"09:00","end":"17:00"}],"tue":[{"start":"09:00","end":"17:00"}],"wed":[{"start":"09:00","end":"17:00"}],"thu":[{"start":"09:00","end":"17:00"}],"fri":[{"start":"09:00","end":"17:00"}],"sat":[],"sun":[]}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_pages TO authenticated;
GRANT ALL ON public.booking_pages TO service_role;

ALTER TABLE public.booking_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage booking pages"
ON public.booking_pages FOR ALL
TO authenticated
USING (public.has_subaccount_access(auth.uid(), sub_account_id))
WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE TRIGGER trg_booking_pages_updated
BEFORE UPDATE ON public.booking_pages
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX booking_pages_sub_idx ON public.booking_pages(sub_account_id);
