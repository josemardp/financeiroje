alter table public.smart_capture_learning 
add column if not exists review_status text check (review_status in ('good', 'bad', 'later')),
add column if not exists review_notes text;

create index if not exists idx_smart_capture_learning_review_status 
on public.smart_capture_learning (review_status);
