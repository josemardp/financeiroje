create table if not exists public.smart_capture_learning (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references public.transactions(id) on delete set null,
  source_text text not null,
  normalized_text text,
  source_type public.source_type not null,
  suggested_payload jsonb not null default '{}'::jsonb,
  final_payload jsonb not null default '{}'::jsonb,
  category_id uuid references public.categories(id) on delete set null,
  transaction_type public.transaction_type not null,
  scope public.scope_type not null,
  confidence_before public.confidence_level,
  confirmation_method text not null default 'mirror_confirmed' check (confirmation_method in ('mirror_confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.smart_capture_learning enable row level security;

create policy "Users can view own smart capture learning"
on public.smart_capture_learning
for select
using (auth.uid() = user_id);

create policy "Users can insert own smart capture learning"
on public.smart_capture_learning
for insert
with check (auth.uid() = user_id);

create index if not exists idx_smart_capture_learning_user_created_at
  on public.smart_capture_learning (user_id, created_at desc);

create index if not exists idx_smart_capture_learning_user_source_type
  on public.smart_capture_learning (user_id, source_type);

create index if not exists idx_smart_capture_learning_normalized_text
  on public.smart_capture_learning (normalized_text);
