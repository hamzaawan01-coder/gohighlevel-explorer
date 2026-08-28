CREATE TABLE public.stripe_webhook_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'processed',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages webhook events"
  ON public.stripe_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_stripe_webhook_events_updated_at
  BEFORE UPDATE ON public.stripe_webhook_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.billing_reconcile_state (
  id text NOT NULL PRIMARY KEY DEFAULT 'default',
  lease_until timestamptz,
  paused_until timestamptz,
  paused_reason text,
  last_run_at timestamptz,
  last_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  consecutive_rate_limits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_reconcile_state TO authenticated;
GRANT ALL ON public.billing_reconcile_state TO service_role;
ALTER TABLE public.billing_reconcile_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members can view reconcile state"
  ON public.billing_reconcile_state FOR SELECT TO authenticated USING (true);
CREATE POLICY "service role manages reconcile state"
  ON public.billing_reconcile_state FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_billing_reconcile_state_updated_at
  BEFORE UPDATE ON public.billing_reconcile_state
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.billing_reconcile_state (id) VALUES ('default')
  ON CONFLICT (id) DO NOTHING;

-- Single-flight lease: returns true only when this caller now owns the lock
CREATE OR REPLACE FUNCTION public.acquire_billing_reconcile_lease(_minutes integer DEFAULT 5)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
BEGIN
  UPDATE public.billing_reconcile_state
     SET lease_until = now() + make_interval(mins => GREATEST(_minutes, 1))
   WHERE id = 'default'
     AND (lease_until IS NULL OR lease_until < now())
  RETURNING true INTO ok;
  RETURN COALESCE(ok, false);
END $$;

CREATE OR REPLACE FUNCTION public.release_billing_reconcile_lease(_result jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.billing_reconcile_state
     SET lease_until = NULL, last_run_at = now(), last_result = COALESCE(_result, '{}'::jsonb)
   WHERE id = 'default';
$$;

CREATE OR REPLACE FUNCTION public.pause_billing_reconcile(_reason text, _minutes integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.billing_reconcile_state
     SET paused_reason = _reason,
         paused_until = CASE WHEN _minutes IS NULL THEN NULL
                             ELSE now() + make_interval(mins => _minutes) END,
         lease_until = NULL
   WHERE id = 'default';
$$;

CREATE OR REPLACE FUNCTION public.resume_billing_reconcile()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.billing_reconcile_state
     SET paused_reason = NULL, paused_until = NULL, consecutive_rate_limits = 0
   WHERE id = 'default';
$$;

REVOKE ALL ON FUNCTION public.acquire_billing_reconcile_lease(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_billing_reconcile_lease(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pause_billing_reconcile(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resume_billing_reconcile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_billing_reconcile_lease(integer) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.release_billing_reconcile_lease(jsonb) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.pause_billing_reconcile(text, integer) TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.resume_billing_reconcile() TO service_role, postgres;