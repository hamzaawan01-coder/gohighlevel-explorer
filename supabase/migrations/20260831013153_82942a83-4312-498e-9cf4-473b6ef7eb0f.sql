ALTER TABLE public.sub_account_subscriptions
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.sub_account_subscriptions
  DROP CONSTRAINT IF EXISTS sub_account_subscriptions_approval_status_check;
ALTER TABLE public.sub_account_subscriptions
  ADD CONSTRAINT sub_account_subscriptions_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Existing workspaces keep working.
UPDATE public.sub_account_subscriptions
   SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at)
 WHERE approval_status = 'pending';

-- Plan modules only apply once the signup is approved.
CREATE OR REPLACE FUNCTION public.subscription_modules(_sub uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN s.approval_status = 'approved' THEN p.modules ELSE '{}'::text[] END
  FROM public.sub_account_subscriptions s
  JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE s.sub_account_id = _sub
    AND s.status IN ('active', 'trialing', 'past_due')
    AND public.has_subaccount_access(auth.uid(), _sub)
$function$;

-- Signups visible to the caller: global admin sees all, agency owners/admins see theirs.
CREATE OR REPLACE FUNCTION public.list_subscription_signups()
 RETURNS TABLE(
   subscription_id uuid,
   sub_account_id uuid,
   sub_account_name text,
   agency_id uuid,
   agency_name text,
   plan_id uuid,
   plan_name text,
   price_cents integer,
   currency text,
   billing_interval text,
   status text,
   approval_status text,
   approved_at timestamptz,
   approver_name text,
   rejection_reason text,
   created_at timestamptz
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, sa.id, sa.name, a.id, a.name,
         p.id, p.name, p.price_cents, p.currency, p.billing_interval,
         s.status, s.approval_status, s.approved_at, pr.full_name, s.rejection_reason,
         s.created_at
  FROM public.sub_account_subscriptions s
  JOIN public.sub_accounts sa ON sa.id = s.sub_account_id
  JOIN public.agencies a ON a.id = sa.agency_id
  LEFT JOIN public.subscription_plans p ON p.id = s.plan_id
  LEFT JOIN public.profiles pr ON pr.id = s.approved_by
  WHERE public.has_role(auth.uid(), 'admin')
     OR public.has_agency_role(auth.uid(), a.id, 'owner')
     OR public.has_agency_role(auth.uid(), a.id, 'admin')
  ORDER BY s.created_at DESC
$function$;

CREATE OR REPLACE FUNCTION public.set_subscription_approval(_sub uuid, _status text, _reason text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '28000';
  END IF;
  IF _status NOT IN ('pending', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid approval status' USING errcode = '22023';
  END IF;
  IF NOT (public.has_role(uid, 'admin') OR public.is_subaccount_admin(uid, _sub)) THEN
    RAISE EXCEPTION 'Not allowed' USING errcode = '42501';
  END IF;

  UPDATE public.sub_account_subscriptions
     SET approval_status = _status,
         approved_by = CASE WHEN _status = 'approved' THEN uid ELSE NULL END,
         approved_at = CASE WHEN _status = 'approved' THEN now() ELSE NULL END,
         rejection_reason = CASE WHEN _status = 'rejected' THEN _reason ELSE NULL END
   WHERE sub_account_id = _sub;
END $function$;

REVOKE ALL ON FUNCTION public.list_subscription_signups() FROM anon;
REVOKE ALL ON FUNCTION public.set_subscription_approval(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_subscription_signups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_subscription_approval(uuid, text, text) TO authenticated;