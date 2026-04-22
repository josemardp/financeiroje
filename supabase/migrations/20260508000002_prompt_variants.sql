-- Sprint 9 — T9.3: infra de A/B testing para prompt_variants

CREATE TABLE public.prompt_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key text NOT NULL UNIQUE,
  variants jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages
  ADD COLUMN prompt_variant_keys jsonb NOT NULL DEFAULT '{}'::jsonb;
