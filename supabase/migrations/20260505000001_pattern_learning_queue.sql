-- 20260505000001_pattern_learning_queue.sql

-- 1. Criar tabela de fila (Outbox)
CREATE TABLE IF NOT EXISTS public.pattern_learning_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  old_category_id uuid REFERENCES public.categories(id),
  new_category_id uuid REFERENCES public.categories(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  processing_started_at timestamptz NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text NULL
);

-- 2. Índices para performance e lock
CREATE INDEX IF NOT EXISTS idx_pattern_learning_queue_pending 
ON public.pattern_learning_queue (created_at) 
WHERE processed_at IS NULL AND attempts < 5;

-- 3. Função de Claim Atômico
CREATE OR REPLACE FUNCTION public.claim_pattern_learning_batch(p_batch_size int)
RETURNS SETOF public.pattern_learning_queue
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.pattern_learning_queue
  SET processing_started_at = now()
  WHERE id IN (
    SELECT id 
    FROM public.pattern_learning_queue 
    WHERE processed_at IS NULL 
      AND (processing_started_at IS NULL OR processing_started_at < now() - interval '5 minutes')
      AND attempts < 5
    ORDER BY created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

-- 4. Função de Incremento de Erro
CREATE OR REPLACE FUNCTION public.increment_queue_attempts(p_ids uuid[], p_error_msg text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.pattern_learning_queue
  SET 
    attempts = attempts + 1,
    last_error = p_error_msg,
    processing_started_at = NULL -- Libera para re-processamento
  WHERE id = ANY(p_ids);
END;
$$;

-- 5. Redefinir Trigger (remover HTTP síncrono e passar a usar a queue)
CREATE OR REPLACE FUNCTION public.notify_pattern_learning_on_correction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Apenas se a categoria mudou e não é nula
  IF (OLD.categoria_id IS DISTINCT FROM NEW.categoria_id) AND NEW.categoria_id IS NOT NULL THEN
    INSERT INTO public.pattern_learning_queue (
      user_id, transaction_id, old_category_id, new_category_id
    ) VALUES (
      NEW.user_id, NEW.id, OLD.categoria_id, NEW.categoria_id
    );
  END IF;
  RETURN NEW;
END;
$$;
