-- Migration: T1.1 — Infraestrutura Base de Observabilidade
-- Descrição: Criação das tabelas system_health_logs e system_health_thresholds

-- ======================================================================================
-- 1. TABELA: system_health_logs
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.system_health_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_name text NOT NULL,
    component_type text NOT NULL,
    status text NOT NULL,
    message text,
    duration_ms integer,
    tokens_used integer,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    
    -- Restrições de integridade
    CONSTRAINT check_health_status CHECK (status IN ('success', 'error', 'warning')),
    CONSTRAINT check_health_component_type CHECK (component_type IN ('cron', 'edge_function', 'db_index', 'embedding', 'external_api'))
);

-- Índices otimizados
CREATE INDEX IF NOT EXISTS idx_health_logs_component_recent ON public.system_health_logs (component_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_status_recent ON public.system_health_logs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_type_recent ON public.system_health_logs (component_type, created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

-- Nota: Sem policies de client. Acesso apenas via service_role.

-- ======================================================================================
-- 2. TABELA: system_health_thresholds
-- ======================================================================================
CREATE TABLE IF NOT EXISTS public.system_health_thresholds (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    component_name text UNIQUE NOT NULL,
    component_type text NOT NULL,
    max_silent_hours integer,
    max_error_count integer,
    max_duration_ms integer,
    alert_enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Restrição de tipo consistente com logs
    CONSTRAINT check_threshold_component_type CHECK (component_type IN ('cron', 'edge_function', 'db_index', 'embedding', 'external_api'))
);

-- RLS (Row Level Security)
ALTER TABLE public.system_health_thresholds ENABLE ROW LEVEL SECURITY;

-- Trigger para updated_at automático (Reutilizando função padrão do projeto)
CREATE TRIGGER update_system_health_thresholds_updated_at
    BEFORE UPDATE ON public.system_health_thresholds
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ======================================================================================
-- 3. OBSERVAÇÕES DE MANUTENÇÃO (TAREFAS FUTURAS)
-- ======================================================================================
-- TODO: T1.3 — Implementar pg_cron para purga automática (retenção de 30 dias):
-- DELETE FROM public.system_health_logs WHERE created_at < now() - interval '30 days';
