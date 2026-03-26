
-- 1. Create security definer function to get familia_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_familia_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT familia_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 2. Drop the recursive policy
DROP POLICY IF EXISTS "Family members can view profiles" ON public.profiles;

-- 3. Recreate it using the security definer function (no recursion)
CREATE POLICY "Family members can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    familia_id = public.get_user_familia_id(auth.uid())
  );

-- 4. Also fix other tables that use the same recursive subquery pattern
-- Fix goals
DROP POLICY IF EXISTS "Users can view family goals" ON public.goals;
CREATE POLICY "Users can view family goals" ON public.goals
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.familia_id = public.get_user_familia_id(auth.uid())
    )
  );

-- Fix transactions
DROP POLICY IF EXISTS "Users can view family transactions" ON public.transactions;
CREATE POLICY "Users can view family transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.familia_id = public.get_user_familia_id(auth.uid())
    )
  );

-- Fix subscriptions
DROP POLICY IF EXISTS "Users can view family subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view family subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.familia_id = public.get_user_familia_id(auth.uid())
    )
  );

-- Fix loans
DROP POLICY IF EXISTS "Users can view family loans" ON public.loans;
CREATE POLICY "Users can view family loans" ON public.loans
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.familia_id = public.get_user_familia_id(auth.uid())
    )
  );

-- Fix recurring_transactions
DROP POLICY IF EXISTS "Users can view family recurring" ON public.recurring_transactions;
CREATE POLICY "Users can view family recurring" ON public.recurring_transactions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.familia_id = public.get_user_familia_id(auth.uid())
    )
  );

-- Fix family_values
DROP POLICY IF EXISTS "Users can view family values" ON public.family_values;
CREATE POLICY "Users can view family values" ON public.family_values
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.familia_id = public.get_user_familia_id(auth.uid())
    )
  );
