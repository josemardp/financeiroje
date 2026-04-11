-- Sprint 4 — T4.1: Preferências declarativas do usuário sobre comportamento da IA
-- Diferente de ai_coach_memory: aqui são CONFIGURAÇÕES, não observações inferidas.
-- Tabela 1:1 com auth.users (PRIMARY KEY = user_id).

CREATE TABLE public.user_ai_preferences (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tom e estilo
  tom_voz              text NOT NULL DEFAULT 'coach'
                       CHECK (tom_voz IN ('direto','empatico','analitico','coach')),
  nivel_detalhamento   text NOT NULL DEFAULT 'medio'
                       CHECK (nivel_detalhamento IN ('executivo','medio','profundo')),
  frequencia_alertas   text NOT NULL DEFAULT 'normal'
                       CHECK (frequencia_alertas IN ('minima','normal','intensa')),

  -- Identidade declarada (vai para o contexto de TODA chamada de IA)
  contexto_identidade  text,  -- ex: "Cap PMESP, casado com Esdra, filha Melinda, CCB"
  valores_pessoais     text[],
  compromissos_fixos   jsonb, -- ex: [{"descricao":"Dízimo CCB","dia":5,"valor":300}]

  -- Preferências religiosas/culturais
  usar_versiculos_acf  boolean NOT NULL DEFAULT false,
  contexto_religioso   text,

  -- Preferências de aconselhamento
  prioridade_default   text CHECK (prioridade_default IN ('seguranca','crescimento','equilibrio')) DEFAULT 'equilibrio',
  tratar_parcelamentos text CHECK (tratar_parcelamentos IN ('mes_atual','competencia','perguntar')) DEFAULT 'perguntar',

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ai_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON public.user_ai_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_ai_preferences_updated_at
  BEFORE UPDATE ON public.user_ai_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
