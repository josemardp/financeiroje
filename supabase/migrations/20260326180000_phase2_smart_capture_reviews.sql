create table if not exists public.smart_capture_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  scope public.scope_type not null,
  source_type public.source_type not null,
  extraction_method text not null check (extraction_method in ('free_text', 'voice', 'photo_ocr')),
  original_input text not null,
  extracted_payload jsonb not null,
  reviewed_payload jsonb not null,
  extracted_state public.data_status not null,
  final_state public.data_status not null default 'confirmed',
  confidence public.confidence_level,
  review_outcome text not null default 'confirmed' check (review_outcome in ('confirmed', 'corrected', 'rejected')),
  rejection_reason text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.smart_capture_reviews enable row level security;

create policy "Users can view own smart capture reviews"
on public.smart_capture_reviews
for select
using (auth.uid() = user_id);

create policy "Users can insert own smart capture reviews"
on public.smart_capture_reviews
for insert
with check (auth.uid() = user_id);

create policy "Users can update own smart capture reviews"
on public.smart_capture_reviews
for update
using (auth.uid() = user_id);

create index if not exists idx_smart_capture_reviews_user_created_at
  on public.smart_capture_reviews (user_id, created_at desc);

create index if not exists idx_smart_capture_reviews_transaction_id
  on public.smart_capture_reviews (transaction_id);
