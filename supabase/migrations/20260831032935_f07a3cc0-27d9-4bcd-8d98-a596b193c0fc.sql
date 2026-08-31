-- 1. Attribution touchpoints -------------------------------------------------
CREATE TABLE public.contact_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL DEFAULT 'other',
  source text NOT NULL DEFAULT 'unknown',
  medium text,
  campaign text,
  content text,
  term text,
  platform text,
  external_campaign_id text,
  referrer text,
  landing_page text,
  click_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_touches_sub_occurred ON public.contact_touches (sub_account_id, occurred_at DESC);
CREATE INDEX idx_contact_touches_contact ON public.contact_touches (contact_id, occurred_at);

GRANT SELECT, INSERT ON public.contact_touches TO authenticated;
GRANT ALL ON public.contact_touches TO service_role;
ALTER TABLE public.contact_touches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read touches" ON public.contact_touches
  FOR SELECT TO authenticated
  USING (public.has_subaccount_access(sub_account_id, auth.uid()));

CREATE POLICY "Members record touches" ON public.contact_touches
  FOR INSERT TO authenticated
  WITH CHECK (public.has_subaccount_access(sub_account_id, auth.uid()));

-- 2. Daily ad spend ----------------------------------------------------------
CREATE TABLE public.ad_spend_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  spend_date date NOT NULL,
  platform public.ad_platform NOT NULL,
  campaign_name text,
  external_campaign_id text,
  spend numeric NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  leads integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GBP',
  entry_source text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_ad_spend_unique
  ON public.ad_spend_daily (sub_account_id, spend_date, platform, coalesce(external_campaign_id, ''), coalesce(campaign_name, ''));
CREATE INDEX idx_ad_spend_sub_date ON public.ad_spend_daily (sub_account_id, spend_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_spend_daily TO authenticated;
GRANT ALL ON public.ad_spend_daily TO service_role;
ALTER TABLE public.ad_spend_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read ad spend" ON public.ad_spend_daily
  FOR SELECT TO authenticated
  USING (public.has_subaccount_access(sub_account_id, auth.uid()));

CREATE POLICY "Members add ad spend" ON public.ad_spend_daily
  FOR INSERT TO authenticated
  WITH CHECK (public.has_subaccount_access(sub_account_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Owner or admin edits ad spend" ON public.ad_spend_daily
  FOR UPDATE TO authenticated
  USING (public.has_subaccount_access(sub_account_id, auth.uid())
         AND (created_by = auth.uid() OR public.is_subaccount_admin(sub_account_id, auth.uid())))
  WITH CHECK (public.has_subaccount_access(sub_account_id, auth.uid()));

CREATE POLICY "Owner or admin deletes ad spend" ON public.ad_spend_daily
  FOR DELETE TO authenticated
  USING (public.has_subaccount_access(sub_account_id, auth.uid())
         AND (created_by = auth.uid() OR public.is_subaccount_admin(sub_account_id, auth.uid())));

CREATE TRIGGER trg_ad_spend_updated_at
  BEFORE UPDATE ON public.ad_spend_daily
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Call outcome tagging ----------------------------------------------------
ALTER TABLE public.phone_calls
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS outcome_note text;

-- 4. Auto-record the first touch when a contact is created -------------------
CREATE OR REPLACE FUNCTION public.tg_contacts_first_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text := nullif(btrim(coalesce(NEW.lead_source, '')), '');
  v_platform text;
BEGIN
  IF v_source IS NULL THEN v_source := 'unknown'; END IF;
  v_platform := CASE
    WHEN NEW.meta_lead_id IS NOT NULL THEN 'meta'
    WHEN v_source ILIKE '%facebook%' OR v_source ILIKE '%instagram%' OR v_source ILIKE '%meta%' THEN 'meta'
    WHEN v_source ILIKE '%google%' THEN 'google'
    WHEN v_source ILIKE '%tiktok%' THEN 'tiktok'
    WHEN v_source ILIKE '%linkedin%' THEN 'linkedin'
    ELSE NULL
  END;

  INSERT INTO public.contact_touches (sub_account_id, contact_id, occurred_at, kind, source, platform)
  VALUES (NEW.sub_account_id, NEW.id, NEW.created_at,
          CASE WHEN NEW.meta_lead_id IS NOT NULL THEN 'lead_ad' ELSE 'contact_created' END,
          v_source, v_platform);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_contacts_first_touch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_contacts_first_touch() FROM anon;
REVOKE ALL ON FUNCTION public.tg_contacts_first_touch() FROM authenticated;

CREATE TRIGGER trg_contacts_first_touch
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.tg_contacts_first_touch();

-- 5. Auto-record a touch when a public form is submitted ---------------------
CREATE OR REPLACE FUNCTION public.tg_form_submission_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form_name text;
BEGIN
  IF NEW.contact_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO v_form_name FROM public.lead_forms WHERE id = NEW.form_id;

  INSERT INTO public.contact_touches
    (sub_account_id, contact_id, occurred_at, kind, source, medium, campaign, landing_page)
  VALUES
    (NEW.sub_account_id, NEW.contact_id, NEW.created_at, 'form',
     coalesce(nullif(btrim(coalesce(NEW.payload->>'utm_source', '')), ''), 'website'),
     nullif(btrim(coalesce(NEW.payload->>'utm_medium', '')), ''),
     coalesce(nullif(btrim(coalesce(NEW.payload->>'utm_campaign', '')), ''), v_form_name),
     NEW.source_url);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_form_submission_touch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_form_submission_touch() FROM anon;
REVOKE ALL ON FUNCTION public.tg_form_submission_touch() FROM authenticated;

CREATE TRIGGER trg_form_submission_touch
  AFTER INSERT ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.tg_form_submission_touch();

-- 6. Backfill first touches for existing contacts ---------------------------
INSERT INTO public.contact_touches (sub_account_id, contact_id, occurred_at, kind, source, platform)
SELECT c.sub_account_id, c.id, c.created_at,
       CASE WHEN c.meta_lead_id IS NOT NULL THEN 'lead_ad' ELSE 'contact_created' END,
       coalesce(nullif(btrim(coalesce(c.lead_source, '')), ''), 'unknown'),
       CASE
         WHEN c.meta_lead_id IS NOT NULL THEN 'meta'
         WHEN c.lead_source ILIKE '%facebook%' OR c.lead_source ILIKE '%instagram%' OR c.lead_source ILIKE '%meta%' THEN 'meta'
         WHEN c.lead_source ILIKE '%google%' THEN 'google'
         WHEN c.lead_source ILIKE '%tiktok%' THEN 'tiktok'
         WHEN c.lead_source ILIKE '%linkedin%' THEN 'linkedin'
         ELSE NULL
       END
FROM public.contacts c
WHERE NOT EXISTS (SELECT 1 FROM public.contact_touches t WHERE t.contact_id = c.id);