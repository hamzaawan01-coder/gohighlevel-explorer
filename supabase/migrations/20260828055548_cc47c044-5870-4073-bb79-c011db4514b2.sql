-- ============ Conversations: assignment, status, read state ============
alter table public.conversations
  add column if not exists assigned_to_user_id uuid references auth.users(id) on delete set null,
  add column if not exists status text not null default 'open',
  add column if not exists snoozed_until timestamptz,
  add column if not exists last_read_at timestamptz,
  add column if not exists priority boolean not null default false;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'conversations_status_check') then
    alter table public.conversations
      add constraint conversations_status_check check (status in ('open','pending','closed'));
  end if;
end $$;

create index if not exists conversations_status_idx on public.conversations (sub_account_id, status, last_message_at desc);
create index if not exists conversations_assigned_idx on public.conversations (sub_account_id, assigned_to_user_id);

-- ============ Booking pages: reminders ============
alter table public.booking_pages
  add column if not exists reminder_offsets integer[] not null default '{1440,60}',
  add column if not exists reminder_channel text not null default 'sms',
  add column if not exists reminder_template text,
  add column if not exists confirmation_enabled boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'booking_pages_reminder_channel_check') then
    alter table public.booking_pages
      add constraint booking_pages_reminder_channel_check check (reminder_channel in ('sms','email','both'));
  end if;
end $$;

-- ============ Calendar events: booking linkage + attendee + status ============
alter table public.calendar_events
  add column if not exists booking_page_id uuid references public.booking_pages(id) on delete set null,
  add column if not exists attendee_email text,
  add column if not exists attendee_phone text,
  add column if not exists status text not null default 'confirmed';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_status_check') then
    alter table public.calendar_events
      add constraint calendar_events_status_check check (status in ('confirmed','cancelled','no_show','completed'));
  end if;
end $$;

-- ============ Appointment reminders ============
create table if not exists public.appointment_reminders (
  id uuid primary key default gen_random_uuid(),
  sub_account_id uuid not null references public.sub_accounts(id) on delete cascade,
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  offset_minutes integer not null,
  channel text not null,
  status text not null default 'pending',
  scheduled_for timestamptz not null,
  outbound_message_id uuid references public.outbound_messages(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_reminders_channel_check check (channel in ('sms','email')),
  constraint appointment_reminders_status_check check (status in ('pending','queued','skipped','failed')),
  constraint appointment_reminders_unique unique (event_id, offset_minutes, channel)
);

create index if not exists appointment_reminders_due_idx
  on public.appointment_reminders (status, scheduled_for);

grant select, insert, update, delete on public.appointment_reminders to authenticated;
grant all on public.appointment_reminders to service_role;

alter table public.appointment_reminders enable row level security;

drop policy if exists "appointment_reminders: sub-account members all" on public.appointment_reminders;
create policy "appointment_reminders: sub-account members all"
  on public.appointment_reminders for all to authenticated
  using (public.has_subaccount_access(auth.uid(), sub_account_id))
  with check (public.has_subaccount_access(auth.uid(), sub_account_id));

drop trigger if exists appointment_reminders_set_updated_at on public.appointment_reminders;
create trigger appointment_reminders_set_updated_at
  before update on public.appointment_reminders
  for each row execute function public.tg_set_updated_at();