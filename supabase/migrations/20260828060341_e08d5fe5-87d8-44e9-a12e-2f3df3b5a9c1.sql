-- Booking page controls
ALTER TABLE public.booking_pages
  ADD COLUMN IF NOT EXISTS allow_reschedule boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_in_app boolean NOT NULL DEFAULT true;

-- Reschedule support on events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS reschedule_token text,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_starts_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS calendar_events_reschedule_token_key
  ON public.calendar_events (reschedule_token)
  WHERE reschedule_token IS NOT NULL;

-- Reminder channel: allow in_app, and track delivery
ALTER TABLE public.appointment_reminders
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
  WHERE conrelid = 'public.appointment_reminders'::regclass
    AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%channel%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.appointment_reminders DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.appointment_reminders
  ADD CONSTRAINT appointment_reminders_channel_check
  CHECK (channel IN ('sms','email','in_app'));

ALTER TABLE public.appointment_reminders
  ADD CONSTRAINT appointment_reminders_delivery_status_check
  CHECK (delivery_status IS NULL OR delivery_status IN ('sent','delivered','failed'));

DROP TRIGGER IF EXISTS trg_appointment_reminders_updated_at ON public.appointment_reminders;
CREATE TRIGGER trg_appointment_reminders_updated_at
  BEFORE UPDATE ON public.appointment_reminders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Audit log
CREATE TABLE IF NOT EXISTS public.appointment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  booking_page_id uuid REFERENCES public.booking_pages(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('booked','rescheduled','edited','cancelled','status_changed','reminder_sent','reminder_failed','reminder_skipped')),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text,
  channel text,
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.appointment_audit TO authenticated;
GRANT ALL ON public.appointment_audit TO service_role;

ALTER TABLE public.appointment_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their workspace appointment audit"
  ON public.appointment_audit FOR SELECT TO authenticated
  USING (public.has_subaccount_access(auth.uid(), sub_account_id));

CREATE INDEX IF NOT EXISTS appointment_audit_sub_created_idx
  ON public.appointment_audit (sub_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS appointment_audit_event_idx
  ON public.appointment_audit (event_id);
CREATE INDEX IF NOT EXISTS appointment_audit_action_idx
  ON public.appointment_audit (sub_account_id, action);