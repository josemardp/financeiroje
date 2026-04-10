CREATE OR REPLACE FUNCTION public.notify_pattern_learning_on_correction()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.source_type IN ('ocr', 'voice', 'document'))
     AND (OLD.categoria_id IS DISTINCT FROM NEW.categoria_id)
     AND (NEW.categoria_id IS NOT NULL) THEN

    PERFORM net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/learn-patterns',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := jsonb_build_object(
        'mode',            'from_correction',
        'user_id',         NEW.user_id,
        'transaction_id',  NEW.id,
        'old_category_id', OLD.categoria_id,
        'new_category_id', NEW.categoria_id
      )
    );

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_learn_on_correction ON public.transactions;

CREATE TRIGGER trg_learn_on_correction
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pattern_learning_on_correction();
