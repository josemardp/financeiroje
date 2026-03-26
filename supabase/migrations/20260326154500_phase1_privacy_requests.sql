create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_id_snapshot uuid not null,
  request_type text not null check (request_type in ('export', 'delete_data', 'delete_account')),
  status text not null default 'requested' check (status in ('requested', 'processing', 'completed', 'failed')),
  reason text,
  confirmation_phrase text,
  result jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.privacy_requests enable row level security;

create policy "Users can view own privacy requests"
on public.privacy_requests
for select
using (auth.uid() = user_id_snapshot);

create policy "Users can insert own privacy requests"
on public.privacy_requests
for insert
with check (auth.uid() = user_id_snapshot);

create index if not exists idx_privacy_requests_user_created_at
  on public.privacy_requests (user_id_snapshot, created_at desc);

create index if not exists idx_privacy_requests_type_status
  on public.privacy_requests (request_type, status);
