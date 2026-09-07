insert into public.subscription_plans (id, agency_id, name, description, price_cents, currency, billing_interval, modules, stripe_price_id, is_active)
values (
  '11111111-2222-4333-8444-555555555555',
  '2e85d000-8923-4a58-b54c-a6e83a857d17',
  'Growth',
  'For teams running paid ads and following up fast — leads, inbox, phone, automations, invoicing and AI reply drafts.',
  9700,
  'gbp',
  'month',
  array['dashboard','contacts','opportunities','tasks','calendar','conversations','calls','forms','templates','workflows','marketing','invoices','reports','attribution','integrations'],
  'plan_11111111222243338444555555555555',
  true
)
on conflict (id) do update set price_cents = excluded.price_cents, currency = excluded.currency, billing_interval = excluded.billing_interval, modules = excluded.modules, stripe_price_id = excluded.stripe_price_id, is_active = true;