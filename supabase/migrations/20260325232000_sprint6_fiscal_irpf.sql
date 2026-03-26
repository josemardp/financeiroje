
-- =====================================================
-- FinanceAI Sprint 6 — Módulo Fiscal / IRPF
-- =====================================================

-- 1. CRIAR ENUM PARA PAPEL DO NEGÓCIO (CLASSIFICAÇÃO CONTÁBIL/FISCAL)
DO $$ BEGIN
    CREATE TYPE public.business_role AS ENUM (
        'receita_operacional',
        'custo_direto',
        'despesa_operacional',
        'tributo',
        'retirada',
        'investimento',
        'financeiro'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. ADICIONAR COLUNAS DE CLASSIFICAÇÃO NAS TRANSAÇÕES E RECORRÊNCIAS
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS papel_negocio public.business_role;
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS papel_negocio public.business_role;

-- 3. ADICIONAR COLUNAS PARA SUPORTE FISCAL/IRPF NAS TRANSAÇÕES
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS e_dedutivel BOOLEAN DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS categoria_fiscal TEXT; -- Ex: 'Saúde', 'Educação', 'Previdência'
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS ano_fiscal INTEGER;

-- 4. ADICIONAR COLUNAS NA TABELA DE CATEGORIAS PARA PADRONIZAÇÃO FISCAL
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS papel_negocio_padrao public.business_role;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS e_dedutivel_padrao BOOLEAN DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS categoria_fiscal_padrao TEXT;

-- 5. ATUALIZAR TABELA DE DOCUMENTOS PARA MELHOR VÍNCULO FISCAL
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS e_dedutivel BOOLEAN DEFAULT false;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS valor_documento NUMERIC(15,2);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS cnpj_cpf_emissor TEXT;

-- 6. MIGRAR DADOS EXISTENTES (FALLBACK e_mei -> papel_negocio)
-- Se e_mei for true e for receita -> receita_operacional
UPDATE public.transactions 
SET papel_negocio = 'receita_operacional' 
WHERE e_mei = true AND tipo = 'income' AND papel_negocio IS NULL;

-- Se e_mei for true e for despesa e for custo -> custo_direto
UPDATE public.transactions 
SET papel_negocio = 'custo_direto' 
WHERE e_mei = true AND tipo = 'expense' AND papel_negocio IS NULL;

-- 7. CONFIGURAÇÕES FISCAIS DO USUÁRIO
CREATE TABLE IF NOT EXISTS public.fiscal_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ano_calendario INTEGER NOT NULL,
    regime_preferencial TEXT DEFAULT 'simplificado', -- 'simplificado' ou 'completo'
    is_mei BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, ano_calendario)
);

-- RLS para fiscal_settings
ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own fiscal_settings" 
ON public.fiscal_settings FOR ALL USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER tr_fiscal_settings_updated_at
    BEFORE UPDATE ON public.fiscal_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
