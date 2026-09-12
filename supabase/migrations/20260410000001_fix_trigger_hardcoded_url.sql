-- AVISO (12/09/2026): esta migration tinha a service_role_key escrita em texto
-- puro no corpo da funcao. A chave foi removida do historico do git e o valor
-- abaixo e um placeholder. A versao correta, que le o segredo do Vault, esta em
-- 20260912000001_trigger_secret_via_vault.sql e substitui esta funcao.
-- Mantida aqui porque migration aplicada nao se edita: se supersede.
--
-- Fix: recria notify_pattern_learning_on_correction() com URL e service_role_key
-- hardcoded, pois ALTER DATABASE SET app.* é bloqueado pelo Supabase managed postgres.
-- Substitui a versão anterior que usava current_setting('app.supabase_url').

CREATE OR REPLACE FUNCTION public.notify_pattern_learning_on_correction()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.source_type IN ('ocr', 'voice', 'document'))
     AND (OLD.categoria_id IS DISTINCT FROM NEW.categoria_id)
     AND (NEW.categoria_id IS NOT NULL) THEN

    PERFORM net.http_post(
      url     := 'https://hhedxktueawursnzqixg.supabase.co/functions/v1/learn-patterns',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer SERVICE_ROLE_KEY_REMOVIDA_DO_HISTORICO'
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
