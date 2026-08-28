CREATE TABLE public.meta_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique,
  meta_user_id text not null,
  status text not null default 'completed',
  deleted_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
CREATE INDEX meta_deletion_requests_meta_user_id_idx ON public.meta_deletion_requests(meta_user_id);
GRANT ALL ON public.meta_deletion_requests TO service_role;
ALTER TABLE public.meta_deletion_requests ENABLE ROW LEVEL SECURITY;