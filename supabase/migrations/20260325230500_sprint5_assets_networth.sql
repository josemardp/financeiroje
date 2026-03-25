
-- =====================================================
-- FinanceAI Sprint 5 — Gestão de Ativos e Patrimônio (Net Worth)
-- =====================================================

-- 1. ENUMS PARA TIPOS DE ATIVOS E INVESTIMENTOS
DO $$ BEGIN
    CREATE TYPE public.asset_type AS ENUM (
        'real_estate',    -- Imóveis
        'vehicle',        -- Veículos
        'stock',          -- Ações/Bolsa
        'crypto',         -- Criptoativos
        'fixed_income',   -- Renda Fixa
        'cash',           -- Dinheiro/Liquidez
        'other'           -- Outros
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. TABELA DE ATIVOS (ASSETS)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    tipo public.asset_type NOT NULL,
    valor_aquisicao NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_atual NUMERIC(15,2) NOT NULL DEFAULT 0,
    data_aquisicao DATE,
    detalhes JSONB DEFAULT '{}'::jsonb, -- Ex: placa, endereço, ticker
    instituicao TEXT,
    liquidez TEXT, -- Ex: D+0, D+30, Imediata
    vencimento DATE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. HISTÓRICO DE VALORIZAÇÃO (ASSET_VALUATIONS)
-- Para rastrear o Net Worth ao longo do tempo
CREATE TABLE IF NOT EXISTS public.asset_valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    valor NUMERIC(15,2) NOT NULL,
    data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. VIEW DE PATRIMÔNIO LÍQUIDO (NET WORTH)
-- Combina ativos, saldos de contas e subtrai dívidas
CREATE OR REPLACE VIEW public.view_net_worth_summary AS
WITH total_assets AS (
    SELECT user_id, SUM(valor_atual) as total FROM public.assets WHERE ativo = true GROUP BY user_id
),
total_accounts AS (
    SELECT user_id, SUM(saldo_atual) as total FROM public.accounts GROUP BY user_id
),
total_liabilities AS (
    SELECT user_id, SUM(saldo_devedor) as total FROM public.loans GROUP BY user_id
)
SELECT 
    u.id as user_id,
    COALESCE(ta.total, 0) + COALESCE(tac.total, 0) as total_assets,
    COALESCE(tl.total, 0) as total_liabilities,
    (COALESCE(ta.total, 0) + COALESCE(tac.total, 0)) - COALESCE(tl.total, 0) as net_worth
FROM auth.users u
LEFT JOIN total_assets ta ON u.id = ta.user_id
LEFT JOIN total_accounts tac ON u.id = tac.user_id
LEFT JOIN total_liabilities tl ON u.id = tl.user_id;

-- 5. RLS POLICIES
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own assets" 
ON public.assets FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own asset valuations" 
ON public.asset_valuations FOR ALL USING (
    EXISTS (SELECT 1 FROM public.assets WHERE id = asset_id AND user_id = auth.uid())
);

-- 6. TRIGGERS PARA UPDATED_AT
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_assets_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. TRIGGER PARA ATUALIZAR VALOR_ATUAL E REGISTRAR HISTÓRICO
CREATE OR REPLACE FUNCTION public.log_asset_valuation()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.valor_atual IS DISTINCT FROM NEW.valor_atual) THEN
        INSERT INTO public.asset_valuations (asset_id, valor, data_referencia)
        VALUES (NEW.id, NEW.valor_atual, CURRENT_DATE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_log_asset_valuation
    AFTER UPDATE ON public.assets
    FOR EACH ROW EXECUTE FUNCTION public.log_asset_valuation();
