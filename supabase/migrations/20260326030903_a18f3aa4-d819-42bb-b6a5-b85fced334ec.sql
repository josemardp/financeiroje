ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS frequency text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS billing_day integer,
  ADD COLUMN IF NOT EXISTS next_charge_date date,
  ADD COLUMN IF NOT EXISTS renewal_date date,
  ADD COLUMN IF NOT EXISTS annual_amount numeric,
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS detection_method text,
  ADD COLUMN IF NOT EXISTS last_amount numeric,
  ADD COLUMN IF NOT EXISTS last_charge_date date;