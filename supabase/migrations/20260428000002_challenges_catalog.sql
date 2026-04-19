-- Migration: challenges_catalog
-- Sprint 7 — T7.5: Tela /challenges
-- Sem RLS — catálogo público de configuração (análogo a achievements_catalog)

CREATE TABLE public.challenges_catalog (
  id            text    PRIMARY KEY,
  title         text    NOT NULL,
  description   text    NOT NULL,
  icon          text,
  duration_days integer NOT NULL
);

-- Supabase auto-habilita RLS em tabelas novas — desabilitar explicitamente
-- pois challenges_catalog é catálogo público de configuração (sem dados de usuário)
ALTER TABLE public.challenges_catalog DISABLE ROW LEVEL SECURITY;

-- Seed: 4 desafios do plano §9.10.4
INSERT INTO public.challenges_catalog (id, title, description, icon, duration_days) VALUES
('registrar_30',
 'Registrador de 30 dias',
 'Registre ao menos uma transação por dia durante 30 dias.',
 '📝', 30),

('sem_saida_7',
 '1 semana sem comer fora',
 'Evite gastos com restaurantes e delivery por 7 dias.',
 '🏠', 7),

('categorizar_semana',
 'Casa arrumada',
 'Categorize todas as transações pendentes nesta semana.',
 '🧹', 7),

('reduzir_despesas',
 'Menos 20% este mês',
 'Reduza suas despesas totais em 20% em relação ao mês anterior.',
 '📉', 30);
