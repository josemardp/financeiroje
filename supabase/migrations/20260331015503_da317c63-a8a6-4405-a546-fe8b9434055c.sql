
-- 1. Add soft-delete columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by uuid DEFAULT NULL;

-- 2. Create index for filtering active transactions
CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at ON public.transactions (deleted_at);

-- 3. Update the SELECT RLS policy to exclude soft-deleted rows for normal queries
-- Drop existing policy and recreate with deleted_at filter
DROP POLICY IF EXISTS "Users can view family transactions" ON public.transactions;
CREATE POLICY "Users can view family transactions"
  ON public.transactions FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      user_id = auth.uid()
      OR user_id IN (
        SELECT p.user_id FROM profiles p
        WHERE p.familia_id = get_user_familia_id(auth.uid())
      )
    )
  );

-- 4. Override DELETE to soft-delete instead
-- We use a BEFORE DELETE trigger to convert DELETE into UPDATE
CREATE OR REPLACE FUNCTION public.soft_delete_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.transactions
  SET deleted_at = now(), deleted_by = auth.uid()
  WHERE id = OLD.id;
  RETURN NULL; -- prevent actual DELETE
END;
$$;

CREATE OR REPLACE TRIGGER trg_soft_delete_transaction
  BEFORE DELETE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.soft_delete_transaction();

-- 5. RPC: get_transaction_trash — returns soft-deleted items for the current user
CREATE OR REPLACE FUNCTION public.get_transaction_trash()
RETURNS TABLE (
  id uuid,
  descricao text,
  valor numeric,
  tipo text,
  data date,
  deleted_at timestamptz,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.descricao,
    t.valor,
    t.tipo::text,
    t.data,
    t.deleted_at,
    (t.deleted_at + interval '30 days') AS expires_at
  FROM public.transactions t
  WHERE t.user_id = auth.uid()
    AND t.deleted_at IS NOT NULL
    AND t.deleted_at > now() - interval '30 days'
  ORDER BY t.deleted_at DESC;
$$;

-- 6. RPC: restore_transaction
CREATE OR REPLACE FUNCTION public.restore_transaction(p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.transactions
  SET deleted_at = NULL, deleted_by = NULL
  WHERE id = p_transaction_id
    AND user_id = auth.uid()
    AND deleted_at IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not owned by user';
  END IF;
END;
$$;

-- 7. RPC: hard_delete_transaction
CREATE OR REPLACE FUNCTION public.hard_delete_transaction(p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable the soft-delete trigger temporarily for this session
  ALTER TABLE public.transactions DISABLE TRIGGER trg_soft_delete_transaction;

  DELETE FROM public.transactions
  WHERE id = p_transaction_id
    AND user_id = auth.uid()
    AND deleted_at IS NOT NULL;

  ALTER TABLE public.transactions ENABLE TRIGGER trg_soft_delete_transaction;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found or not owned by user';
  END IF;
END;
$$;

-- 8. RPC: purge_expired_deleted_transactions
CREATE OR REPLACE FUNCTION public.purge_expired_deleted_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE public.transactions DISABLE TRIGGER trg_soft_delete_transaction;

  DELETE FROM public.transactions
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

  ALTER TABLE public.transactions ENABLE TRIGGER trg_soft_delete_transaction;
END;
$$;
