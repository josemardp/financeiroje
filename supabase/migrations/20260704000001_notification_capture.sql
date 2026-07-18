-- Migration: 20260704000001_notification_capture.sql
-- Descrição: Adiciona 'notification' ao enum source_type e cria a tabela de eventos de captura de notificações.

-- Adicionar o valor ao enum source_type (com tratamento de erro caso já exista)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'source_type' AND e.enumlabel = 'notification'
  ) THEN
    ALTER TYPE source_type ADD VALUE 'notification';
  END IF;
END
$$;

-- Criar a tabela de eventos de captura de notificações
CREATE TABLE IF NOT EXISTS notification_capture_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id) NOT NULL,
  source_app          text NOT NULL,
  notification_hash   text NOT NULL,
  title               text,
  content             text,
  parsed_amount       numeric(10,2),
  parsed_merchant     text,
  parsed_type         text CHECK (parsed_type IN ('income', 'expense')),
  transaction_id      uuid REFERENCES transactions(id) ON DELETE SET NULL,
  ignored_at          timestamptz,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT unique_user_notification_hash UNIQUE(user_id, notification_hash)
);

-- Habilitar RLS
ALTER TABLE notification_capture_events ENABLE ROW LEVEL SECURITY;

-- Criar política RLS (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notification_capture_events' AND policyname = 'Users access own notification events'
  ) THEN
    CREATE POLICY "Users access own notification events"
      ON notification_capture_events FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_notification_events_user_hash ON notification_capture_events(user_id, notification_hash);
CREATE INDEX IF NOT EXISTS idx_notification_events_transaction ON notification_capture_events(transaction_id);

-- Trigger de updated_at
DROP TRIGGER IF EXISTS trg_notification_events_updated_at ON notification_capture_events;
CREATE TRIGGER trg_notification_events_updated_at
  BEFORE UPDATE ON notification_capture_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
