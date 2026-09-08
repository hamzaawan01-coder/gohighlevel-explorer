ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at timestamptz, ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS contacts_deleted_at_idx ON public.contacts (sub_account_id, deleted_at);
CREATE INDEX IF NOT EXISTS deals_deleted_at_idx ON public.deals (sub_account_id, deleted_at);
CREATE INDEX IF NOT EXISTS tasks_deleted_at_idx ON public.tasks (sub_account_id, deleted_at);
CREATE INDEX IF NOT EXISTS invoices_deleted_at_idx ON public.invoices (sub_account_id, deleted_at);

CREATE OR REPLACE FUNCTION public.recycle_bin_soft_delete(_entity text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sub uuid;
BEGIN
  IF _entity NOT IN ('contacts','deals','tasks','invoices') THEN
    RAISE EXCEPTION 'Unsupported entity %', _entity;
  END IF;
  EXECUTE format('SELECT sub_account_id FROM public.%I WHERE id = $1', _entity)
    INTO _sub USING _id;
  IF _sub IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF NOT public.has_subaccount_access(auth.uid(), _sub) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  EXECUTE format('UPDATE public.%I SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL', _entity)
    USING _id, auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.recycle_bin_restore(_entity text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sub uuid;
BEGIN
  IF _entity NOT IN ('contacts','deals','tasks','invoices') THEN
    RAISE EXCEPTION 'Unsupported entity %', _entity;
  END IF;
  EXECUTE format('SELECT sub_account_id FROM public.%I WHERE id = $1', _entity)
    INTO _sub USING _id;
  IF _sub IS NULL THEN RAISE EXCEPTION 'Record not found'; END IF;
  IF NOT public.is_subaccount_admin(auth.uid(), _sub) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  EXECUTE format('UPDATE public.%I SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', _entity)
    USING _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recycle_bin_purge(_entity text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _sub uuid;
BEGIN
  IF _entity NOT IN ('contacts','deals','tasks','invoices') THEN
    RAISE EXCEPTION 'Unsupported entity %', _entity;
  END IF;
  EXECUTE format('SELECT sub_account_id FROM public.%I WHERE id = $1 AND deleted_at IS NOT NULL', _entity)
    INTO _sub USING _id;
  IF _sub IS NULL THEN RAISE EXCEPTION 'Record not found in recycle bin'; END IF;
  IF NOT public.is_subaccount_admin(auth.uid(), _sub) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id = $1 AND deleted_at IS NOT NULL', _entity)
    USING _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_recycle_bin(_sub uuid)
RETURNS TABLE(entity text, id uuid, label text, deleted_at timestamptz, deleted_by uuid, deleted_by_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM (
    SELECT 'contacts'::text AS entity, c.id,
           COALESCE(NULLIF(TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), ''), c.email, c.phone, 'Contact') AS label,
           c.deleted_at, c.deleted_by, p.full_name AS deleted_by_name
    FROM public.contacts c LEFT JOIN public.profiles p ON p.id = c.deleted_by
    WHERE c.sub_account_id = _sub AND c.deleted_at IS NOT NULL
      AND public.is_subaccount_admin(auth.uid(), _sub)
    UNION ALL
    SELECT 'deals'::text, d.id, COALESCE(NULLIF(d.title,''), 'Opportunity'), d.deleted_at, d.deleted_by, p.full_name
    FROM public.deals d LEFT JOIN public.profiles p ON p.id = d.deleted_by
    WHERE d.sub_account_id = _sub AND d.deleted_at IS NOT NULL
      AND public.is_subaccount_admin(auth.uid(), _sub)
    UNION ALL
    SELECT 'tasks'::text, t.id, COALESCE(NULLIF(t.title,''), 'Task'), t.deleted_at, t.deleted_by, p.full_name
    FROM public.tasks t LEFT JOIN public.profiles p ON p.id = t.deleted_by
    WHERE t.sub_account_id = _sub AND t.deleted_at IS NOT NULL
      AND public.is_subaccount_admin(auth.uid(), _sub)
    UNION ALL
    SELECT 'invoices'::text, i.id, COALESCE(NULLIF(i.number,''), 'Invoice'), i.deleted_at, i.deleted_by, p.full_name
    FROM public.invoices i LEFT JOIN public.profiles p ON p.id = i.deleted_by
    WHERE i.sub_account_id = _sub AND i.deleted_at IS NOT NULL
      AND public.is_subaccount_admin(auth.uid(), _sub)
  ) rows ORDER BY deleted_at DESC;
$$;

REVOKE ALL ON FUNCTION public.recycle_bin_soft_delete(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recycle_bin_restore(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recycle_bin_purge(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_recycle_bin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recycle_bin_soft_delete(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recycle_bin_restore(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recycle_bin_purge(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_recycle_bin(uuid) TO authenticated, service_role;