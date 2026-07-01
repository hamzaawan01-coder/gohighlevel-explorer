-- 1) Add new enum value
ALTER TYPE public.workflow_trigger ADD VALUE IF NOT EXISTS 'deal.created';

-- 2) Update deals workflow trigger function to handle INSERT
CREATE OR REPLACE FUNCTION public.tg_deals_workflow()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if tg_op = 'INSERT' then
    perform public.run_workflows(
      'deal.created'::public.workflow_trigger,
      new.sub_account_id,
      new.id,
      jsonb_build_object(
        'deal_id', new.id,
        'owner_id', new.owner_id,
        'stage_id', new.stage_id,
        'contact_id', new.contact_id
      )
    );
  elsif tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id then
    perform public.run_workflows(
      'deal.stage_changed'::public.workflow_trigger,
      new.sub_account_id,
      new.id,
      jsonb_build_object(
        'deal_id', new.id,
        'owner_id', new.owner_id,
        'old_stage_id', old.stage_id,
        'new_stage_id', new.stage_id,
        'contact_id', new.contact_id
      )
    );
  end if;
  return new;
end $function$;

-- 3) Recreate trigger to also fire on INSERT
DROP TRIGGER IF EXISTS deals_workflow ON public.deals;
CREATE TRIGGER deals_workflow
AFTER INSERT OR UPDATE ON public.deals
FOR EACH ROW EXECUTE FUNCTION public.tg_deals_workflow();