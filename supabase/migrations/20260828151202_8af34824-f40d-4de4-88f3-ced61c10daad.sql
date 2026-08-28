REVOKE EXECUTE ON FUNCTION public.tg_invoice_assign_number() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_invoice_items_recalc() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_invoice_tax_recalc() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalc_invoice_totals(uuid) FROM anon, authenticated, public;