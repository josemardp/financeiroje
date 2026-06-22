-- Agrega histórico de transações por mês no servidor.
-- Evita trazer milhares de linhas brutas para o cliente (contextCollector).
CREATE OR REPLACE FUNCTION get_monthly_history(
  p_user_id    uuid,
  p_start_date date,
  p_end_date   date,
  p_scope      text DEFAULT 'all'
)
RETURNS TABLE (
  mes            int,
  ano            int,
  label          text,
  total_income   numeric,
  total_expense  numeric,
  balance        numeric,
  savings_rate   numeric,
  top_categorias jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      date_trunc('month', t.data::date)      AS month_start,
      t.tipo,
      t.valor,
      COALESCE(c.nome, 'Sem categoria')      AS cat_nome
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.categoria_id
    WHERE t.user_id = p_user_id
      AND t.data::date >= p_start_date
      AND t.data::date <= p_end_date
      AND (p_scope = 'all' OR t.scope::text = p_scope)
      AND (t.data_status = 'confirmed' OR t.data_status IS NULL)
  ),
  monthly AS (
    SELECT
      month_start,
      EXTRACT(MONTH FROM month_start)::int   AS mes,
      EXTRACT(YEAR FROM month_start)::int    AS ano,
      COALESCE(SUM(CASE WHEN tipo = 'income'  THEN valor ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN tipo = 'expense' THEN valor ELSE 0 END), 0) AS total_expense
    FROM base
    GROUP BY month_start
  ),
  cat_raw AS (
    SELECT month_start, cat_nome, SUM(valor) AS cat_total
    FROM base
    WHERE tipo = 'expense'
    GROUP BY month_start, cat_nome
  ),
  cat_ranked AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY month_start ORDER BY cat_total DESC) AS rn
    FROM cat_raw
  ),
  top_cats AS (
    SELECT
      cr.month_start,
      jsonb_agg(
        jsonb_build_object(
          'nome',       cr.cat_nome,
          'total',      cr.cat_total,
          'percentual', CASE WHEN m.total_expense > 0
                          THEN (cr.cat_total / m.total_expense) * 100
                          ELSE 0 END
        )
        ORDER BY cr.cat_total DESC
      ) AS top_categorias
    FROM cat_ranked cr
    JOIN monthly m USING (month_start)
    WHERE cr.rn <= 3
    GROUP BY cr.month_start
  )
  SELECT
    m.mes,
    m.ano,
    LPAD(m.mes::text, 2, '0') || '/' || m.ano::text  AS label,
    m.total_income,
    m.total_expense,
    m.total_income - m.total_expense                   AS balance,
    CASE WHEN m.total_income > 0
      THEN ((m.total_income - m.total_expense) / m.total_income) * 100
      ELSE 0 END                                        AS savings_rate,
    COALESCE(tc.top_categorias, '[]'::jsonb)            AS top_categorias
  FROM monthly m
  LEFT JOIN top_cats tc USING (month_start)
  ORDER BY m.ano, m.mes;
$$;

REVOKE EXECUTE ON FUNCTION get_monthly_history(uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_monthly_history(uuid, date, date, text) TO authenticated;

-- Validação: função criada e acessível
SELECT
  p.proname                     AS funcao,
  pg_get_function_arguments(p.oid) AS argumentos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_monthly_history';
