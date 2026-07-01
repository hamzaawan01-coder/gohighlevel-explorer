
-- =========================================================================
-- Message templates
-- =========================================================================
create type public.template_channel as enum ('email','sms');

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  created_by uuid not null,
  name text not null,
  channel public.template_channel not null,
  subject text,
  body_html text,
  body_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.message_templates to authenticated;
grant all on public.message_templates to service_role;

alter table public.message_templates enable row level security;

create policy "templates: subaccount access"
  on public.message_templates for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.tg_set_updated_at();

create index message_templates_sub_idx on public.message_templates(sub_account_id, created_at desc);

-- =========================================================================
-- Campaigns (bulk email/SMS)
-- =========================================================================
create type public.campaign_status as enum ('draft','scheduled','sending','sent','failed');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  created_by uuid not null,
  name text not null,
  channel public.template_channel not null,
  template_id uuid references public.message_templates(id) on delete set null,
  subject text,
  body_html text,
  body_text text,
  -- Segment filter: { tags?: string[], stage?: string, has_email?: bool, has_phone?: bool }
  segment jsonb not null default '{}'::jsonb,
  status public.campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_recipients int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.campaigns to authenticated;
grant all on public.campaigns to service_role;

alter table public.campaigns enable row level security;

create policy "campaigns: subaccount access"
  on public.campaigns for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.tg_set_updated_at();

create index campaigns_sub_idx on public.campaigns(sub_account_id, created_at desc);

create table public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  outbound_message_id uuid references public.outbound_messages(id) on delete set null,
  to_address text not null,
  status text not null default 'queued',  -- queued|sent|failed
  error text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.campaign_recipients to authenticated;
grant all on public.campaign_recipients to service_role;

alter table public.campaign_recipients enable row level security;

create policy "campaign_recipients: subaccount access"
  on public.campaign_recipients for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create index campaign_recipients_campaign_idx on public.campaign_recipients(campaign_id);

-- =========================================================================
-- Trigger links (trackable short links)
-- =========================================================================
create table public.trigger_links (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  created_by uuid not null,
  slug text not null unique,
  name text not null,
  target_url text not null,
  click_count int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.trigger_links to authenticated;
grant all on public.trigger_links to service_role;
-- No anon grant: public redirect uses service_role via server route.

alter table public.trigger_links enable row level security;

create policy "trigger_links: subaccount access"
  on public.trigger_links for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger trigger_links_set_updated_at
  before update on public.trigger_links
  for each row execute function public.tg_set_updated_at();

create index trigger_links_sub_idx on public.trigger_links(sub_account_id, created_at desc);

create table public.trigger_link_clicks (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.trigger_links(id) on delete cascade,
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  ip_address text,
  user_agent text,
  clicked_at timestamptz not null default now()
);

grant select on public.trigger_link_clicks to authenticated;
grant all on public.trigger_link_clicks to service_role;

alter table public.trigger_link_clicks enable row level security;

create policy "trigger_link_clicks: subaccount read"
  on public.trigger_link_clicks for select to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id));

create index trigger_link_clicks_link_idx on public.trigger_link_clicks(link_id, clicked_at desc);

-- Add link.clicked to workflow_trigger enum
alter type public.workflow_trigger add value if not exists 'link.clicked';

-- =========================================================================
-- Social posts (scheduled)
-- =========================================================================
create type public.social_platform as enum ('facebook','instagram','linkedin','twitter');
create type public.social_post_status as enum ('draft','scheduled','published','failed');

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  created_by uuid not null,
  platform public.social_platform not null,
  content text not null,
  media_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  status public.social_post_status not null default 'draft',
  external_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.social_posts to authenticated;
grant all on public.social_posts to service_role;

alter table public.social_posts enable row level security;

create policy "social_posts: subaccount access"
  on public.social_posts for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger social_posts_set_updated_at
  before update on public.social_posts
  for each row execute function public.tg_set_updated_at();

create index social_posts_sub_idx on public.social_posts(sub_account_id, scheduled_at desc);

-- =========================================================================
-- Ad campaigns (manual tracker)
-- =========================================================================
create type public.ad_platform as enum ('google','meta','linkedin','tiktok','other');
create type public.ad_campaign_status as enum ('draft','active','paused','completed');

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  created_by uuid not null,
  name text not null,
  platform public.ad_platform not null,
  status public.ad_campaign_status not null default 'draft',
  budget numeric(12,2) default 0,
  spend numeric(12,2) default 0,
  impressions int default 0,
  clicks int default 0,
  conversions int default 0,
  start_date date,
  end_date date,
  notes text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.ad_campaigns to authenticated;
grant all on public.ad_campaigns to service_role;

alter table public.ad_campaigns enable row level security;

create policy "ad_campaigns: subaccount access"
  on public.ad_campaigns for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

create trigger ad_campaigns_set_updated_at
  before update on public.ad_campaigns
  for each row execute function public.tg_set_updated_at();

create index ad_campaigns_sub_idx on public.ad_campaigns(sub_account_id, created_at desc);
