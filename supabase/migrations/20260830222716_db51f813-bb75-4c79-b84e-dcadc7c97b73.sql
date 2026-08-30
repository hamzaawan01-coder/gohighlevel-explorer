CREATE OR REPLACE FUNCTION public.tg_invoice_clear_stale_payment_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.total IS DISTINCT FROM OLD.total
     AND NEW.stripe_payment_link_url IS NOT DISTINCT FROM OLD.stripe_payment_link_url THEN
    NEW.stripe_payment_link_url := NULL;
    NEW.stripe_payment_link_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_clear_stale_payment_link ON public.invoices;
CREATE TRIGGER invoices_clear_stale_payment_link
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.tg_invoice_clear_stale_payment_link();