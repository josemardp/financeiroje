-- Sprint 2: Adicionar escopo à tabela de alertas para governança multi-contexto
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'alerts' AND column_name = 'scope') THEN
        ALTER TABLE alerts ADD COLUMN scope TEXT DEFAULT 'private';
    END IF;
END $$;
UPDATE alerts SET scope = 'private' WHERE scope IS NULL;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_scope_check;
ALTER TABLE alerts ADD CONSTRAINT alerts_scope_check CHECK (scope IN ('private', 'family', 'business'));
