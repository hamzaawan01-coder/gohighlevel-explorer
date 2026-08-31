-- 1. Provider credentials become write-only for signed-in users.
REVOKE SELECT (email_config, sms_config) ON public.sub_account_integrations FROM authenticated;
REVOKE SELECT ON public.sub_account_integrations FROM anon;
GRANT SELECT (
  sub_account_id, email_provider, email_from_address, email_from_name, email_verified_at,
  sms_provider, sms_from_number, sms_verified_at, updated_at
) ON public.sub_account_integrations TO authenticated;
GRANT ALL ON public.sub_account_integrations TO service_role;

-- 2. Internal-only SECURITY DEFINER routines: not callable by app users.
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.run_workflows(workflow_trigger, uuid, uuid, jsonb)',
    'public.scan_time_workflows()',
    'public.recalc_invoice_totals(uuid)',
    'public.in_quiet_hours(uuid, timestamptz)',
    'public.next_send_time(uuid, timestamptz)',
    'public.render_merge_tags(text, jsonb)',
    'public.acquire_billing_reconcile_lease(integer)',
    'public.release_billing_reconcile_lease(jsonb)',
    'public.pause_billing_reconcile(text, integer)',
    'public.resume_billing_reconcile()',
    'public.handle_new_user()',
    'public.tg_apply_module_presets()',
    'public.tg_bump_conversation()',
    'public.tg_contacts_workflow()',
    'public.tg_deals_workflow()',
    'public.tg_form_submissions_workflow()',
    'public.tg_invoice_assign_number()',
    'public.tg_invoice_clear_stale_payment_link()',
    'public.tg_invoice_items_recalc()',
    'public.tg_invoice_tax_recalc()',
    'public.tg_log_module_change()',
    'public.tg_log_subscription_change()',
    'public.tg_set_updated_at()',
    'public.tg_tasks_workflow()'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
