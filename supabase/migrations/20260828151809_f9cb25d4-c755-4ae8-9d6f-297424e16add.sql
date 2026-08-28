ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS stripe_payment_link_url text,
  ADD COLUMN IF NOT EXISTS stripe_payment_link_id text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_interval_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_reminders integer NOT NULL DEFAULT 3;

ALTER TABLE public.outbound_messages
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS outbound_messages_invoice_idx ON public.outbound_messages(invoice_id);
CREATE INDEX IF NOT EXISTS invoices_stripe_session_idx ON public.invoices(stripe_checkout_session_id);

CREATE TABLE IF NOT EXISTS public.invoice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.invoice_events TO authenticated;
GRANT ALL ON public.invoice_events TO service_role;
ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice events readable by workspace" ON public.invoice_events
  FOR SELECT TO authenticated USING (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE POLICY "invoice events insertable by workspace" ON public.invoice_events
  FOR INSERT TO authenticated WITH CHECK (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE INDEX IF NOT EXISTS invoice_events_invoice_idx ON public.invoice_events(invoice_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.invoice_branding (
  sub_account_id uuid PRIMARY KEY REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  business_name text,
  logo_url text,
  accent_color text NOT NULL DEFAULT '#4f46e5',
  address text,
  payment_instructions text,
  terms text,
  footer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_branding TO authenticated;
GRANT ALL ON public.invoice_branding TO service_role;
ALTER TABLE public.invoice_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice branding readable by workspace" ON public.invoice_branding
  FOR SELECT TO authenticated USING (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE POLICY "invoice branding manageable by workspace admins" ON public.invoice_branding
  FOR ALL TO authenticated
  USING (public.is_subaccount_admin(auth.uid(), sub_account_id))
  WITH CHECK (public.is_subaccount_admin(auth.uid(), sub_account_id));
CREATE TRIGGER invoice_branding_set_updated_at BEFORE UPDATE ON public.invoice_branding
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.invoice_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sub_account_id uuid NOT NULL REFERENCES public.sub_accounts(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 1,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  error text,
  outbound_message_id uuid REFERENCES public.outbound_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoice_reminders TO authenticated;
GRANT ALL ON public.invoice_reminders TO service_role;
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoice reminders readable by workspace" ON public.invoice_reminders
  FOR SELECT TO authenticated USING (public.has_subaccount_access(auth.uid(), sub_account_id));
CREATE TRIGGER invoice_reminders_set_updated_at BEFORE UPDATE ON public.invoice_reminders
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS invoice_reminders_invoice_idx ON public.invoice_reminders(invoice_id, sequence);