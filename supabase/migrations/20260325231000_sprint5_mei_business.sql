
-- =====================================================
-- FinanceAI Sprint 5 — Módulo MEI / Business
-- =====================================================

-- 1. ADICIONAR COLUNA PARA CLASSIFICAÇÃO DE CUSTO OPERACIONAL
-- Distinguir entre Custo (direto) e Despesa (indireta/fixa) para o MEI
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_business_cost BOOLEAN DEFAULT false;

-- 2. TABELA DE CONFIGURAÇÃO MEI (LIMITES E ALERTAS)
CREATE TABLE IF NOT EXISTS public.mei_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ano_referencia INTEGER NOT NULL,
    limite_anual NUMERIC(15,2) NOT NULL DEFAULT 81000.00,
    alerta_threshold_percent INTEGER NOT NULL DEFAULT 80, -- Alerta quando atingir 80%
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, ano_referencia)
);

-- 3. RLS POLICIES
ALTER TABLE public.mei_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mei_settings" 
ON public.mei_settings FOR ALL USING (auth.uid() = user_id);

-- 4. TRIGGER PARA UPDATED_AT
CREATE TRIGGER tr_mei_settings_updated_at
    BEFORE UPDATE ON public.mei_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. INSERIR CATEGORIAS PADRÃO MEI SE NÃO EXISTIREM
-- (Exemplo de categorias que são tipicamente custos operacionais)
UPDATE public.categories SET is_business_cost = true WHERE nome IN ('Mercadorias para Revenda', 'Matéria-prima', 'Fretes', 'Embalagens') AND scope = 'business';
