-- Substitui notify_pattern_learning_on_correction() para ler a service_role_key
-- e a URL do projeto no Vault do Supabase, em vez de tê-las escritas no corpo
-- da função.
--
-- Contexto. A versão de 20260410000001 colou a chave em texto puro dentro da
-- função, porque ALTER DATABASE SET app.* é bloqueado no Postgres gerenciado e
-- current_setting() não tinha de onde ler. A saída correta é a extensão
-- supabase_vault: o segredo fica cifrado no banco e a função lê em tempo de
-- execução. Segredo em migration vai para o git, e git não é cofre.
--
-- Antes de aplicar, uma vez, pelo SQL Editor do projeto:
--   select vault.create_secret('<service_role_key>', 'service_role_key');
--   select vault.create_secret('https://<ref>.supabase.co', 'supabase_url');
--
-- Se um dos dois segredos faltar, a função avisa e segue sem chamar a Edge
-- Function: a correção da categoria continua valendo, só o aprendizado de
-- padrão não dispara. Falha fechada, sem derrubar o UPDATE do usuário.

CREATE OR REPLACE FUNCTION public.notify_pattern_learning_on_correction()
RETURNS TRIGGER AS $$
DECLARE
  v_key text;
  v_url text;
BEGIN
  IF (OLD.source_type IN ('ocr', 'voice', 'document'))
     AND (OLD.categoria_id IS DISTINCT FROM NEW.categoria_id)
     AND (NEW.categoria_id IS NOT NULL) THEN

    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets
     WHERE name = 'service_role_key'
     LIMIT 1;

    SELECT decrypted_secret INTO v_url
      FROM vault.decrypted_secrets
     WHERE name = 'supabase_url'
     LIMIT 1;

    IF v_key IS NULL OR v_url IS NULL THEN
      RAISE WARNING 'notify_pattern_learning_on_correction: segredo ausente no Vault (service_role_key ou supabase_url); chamada ignorada';
      RETURN NEW;
    END IF;

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/learn-patterns',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
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

-- A função é SECURITY DEFINER e lê o Vault, então quem pode chamá-la direto
-- poderia extrair o segredo. Restringe a execução ao trigger.
REVOKE EXECUTE ON FUNCTION public.notify_pattern_learning_on_correction() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_pattern_learning_on_correction() FROM anon, authenticated;
