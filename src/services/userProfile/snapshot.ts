/**
 * userProfile/snapshot.ts
 *
 * Retorna um snapshot leve do comportamento do usuário para enriquecer
 * prompts da Captura Inteligente.
 *
 * NÃO recalcula o contextCollector inteiro — é uma versão enxuta otimizada
 * para o caso de uso da Captura: 1 query, ~200ms, sem dependência de engine.
 *
 * Falha silenciosa: retorna snapshot em branco se a query falhar.
 * Não bloqueia o fluxo de captura.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ScopeType } from "@/contexts/ScopeContext";
import { buildArchetype } from "./buildArchetype";

export interface UserBehavioralSnapshot {
  arquetipo: string;
  arquetipoDescricao: string;
  topCategorias: Array<{ nome: string; tipo: "income" | "expense"; usosNoMes: number }>;
  faixasTipicas: {
    despesaMediana: number;
    despesaP10: number;
    despesaP90: number;
    receitaMediana: number;
  };
  beneficiariosFrequentes: Array<{ nome: string; vezes: number; ultimaVez: string }>;
  /**
   * Padrão temporal de uso do app.
   * Implementação real no Sprint 6 (user_engagement_events).
   * Nesta versão retorna sempre indefinido/null.
   */
  padraoTemporal: {
    horarioMaisAtivo: "manha" | "tarde" | "noite" | "indefinido";
    diaSemanaMaisAtivo: number | null;
  };
}

const SNAPSHOT_BLANK: UserBehavioralSnapshot = {
  arquetipo: "indefinido",
  arquetipoDescricao: "Dados insuficientes para identificar perfil comportamental com segurança.",
  topCategorias: [],
  faixasTipicas: { despesaMediana: 0, despesaP10: 0, despesaP90: 0, receitaMediana: 0 },
  beneficiariosFrequentes: [],
  padraoTemporal: { horarioMaisAtivo: "indefinido", diaSemanaMaisAtivo: null },
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

/**
 * Retorna um snapshot comportamental leve do usuário para enriquecer o
 * prompt da Captura Inteligente.
 *
 * @param userId  ID do usuário autenticado
 * @param scope   Escopo ativo (private | family | business | all)
 */
export async function getUserBehavioralSnapshot(
  userId: string,
  scope: ScopeType
): Promise<UserBehavioralSnapshot> {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const since = ninetyDaysAgo.toISOString().split("T")[0];

    let query = supabase
      .from("transactions")
      .select("id, valor, tipo, data, descricao, categoria_id, categories(nome)")
      .eq("data_status", "confirmed")
      .gte("data", since)
      .order("data", { ascending: false });

    if (scope !== "all") {
      query = query.eq("scope", scope);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return SNAPSHOT_BLANK;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const monthStart = thirtyDaysAgo.toISOString().split("T")[0];

    // ── Top categorias (últimos 30 dias, por contagem de usos) ──────────────

    const catCountMap = new Map<string, { nome: string; tipo: "income" | "expense"; count: number }>();

    for (const t of data) {
      if (!t.categoria_id || t.data < monthStart) continue;
      const tipo = t.tipo === "income" ? "income" : "expense";
      const catNome = (t.categories as { nome: string } | null)?.nome ?? "Sem categoria";
      const key = `${t.categoria_id}:${tipo}`;
      const existing = catCountMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        catCountMap.set(key, { nome: catNome, tipo, count: 1 });
      }
    }

    const topCategorias = [...catCountMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => ({ nome: c.nome, tipo: c.tipo, usosNoMes: c.count }));

    // ── Faixas típicas de valor (últimos 90 dias) ────────────────────────────

    const expenseValues = data
      .filter((t) => t.tipo === "expense")
      .map((t) => Number(t.valor))
      .sort((a, b) => a - b);

    const incomeValues = data
      .filter((t) => t.tipo === "income")
      .map((t) => Number(t.valor))
      .sort((a, b) => a - b);

    const faixasTipicas = {
      despesaP10: expenseValues.length >= 5 ? percentile(expenseValues, 0.1) : 0,
      despesaMediana: expenseValues.length >= 5 ? percentile(expenseValues, 0.5) : 0,
      despesaP90: expenseValues.length >= 5 ? percentile(expenseValues, 0.9) : 0,
      receitaMediana: incomeValues.length >= 5 ? percentile(incomeValues, 0.5) : 0,
    };

    // ── Beneficiários frequentes (por descrição, últimos 90 dias) ────────────

    const descMap = new Map<string, { vezes: number; ultimaVez: string }>();

    for (const t of data) {
      if (!t.descricao) continue;
      const key = t.descricao.trim().toLowerCase();
      if (key.length < 3) continue;
      const existing = descMap.get(key);
      if (existing) {
        existing.vezes += 1;
        if (t.data > existing.ultimaVez) existing.ultimaVez = t.data;
      } else {
        descMap.set(key, { vezes: 1, ultimaVez: t.data });
      }
    }

    const beneficiariosFrequentes = [...descMap.entries()]
      .filter(([, v]) => v.vezes >= 2)
      .sort((a, b) => b[1].vezes - a[1].vezes)
      .slice(0, 5)
      .map(([nome, v]) => ({ nome, vezes: v.vezes, ultimaVez: v.ultimaVez }));

    // ── Arquétipo (inputs derivados do histórico de 90 dias) ─────────────────

    // Agrupa transações confirmadas por mês para calcular métricas mensais
    const monthBuckets = new Map<string, { income: number; expense: number; txCount: number }>();
    for (const t of data) {
      const key = t.data.substring(0, 7); // "YYYY-MM"
      const bucket = monthBuckets.get(key) ?? { income: 0, expense: 0, txCount: 0 };
      bucket.txCount += 1;
      if (t.tipo === "income") bucket.income += Number(t.valor);
      else bucket.expense += Number(t.valor);
      monthBuckets.set(key, bucket);
    }

    const monthsWithData = monthBuckets.size;
    const monthList = [...monthBuckets.values()];

    const avgSavingsRate =
      monthsWithData > 0
        ? monthList.reduce((sum, m) => {
            const rate = m.income > 0 ? ((m.income - m.expense) / m.income) * 100 : 0;
            return sum + rate;
          }, 0) / monthsWithData
        : 0;

    const consistenciaRegistro: "alta" | "media" | "baixa" =
      monthsWithData >= 3 ? "alta" : monthsWithData >= 2 ? "media" : "baixa";

    // indicadorImpulsividade: despesas pequenas (<R$50) / total de despesas
    const allExpenses = data.filter((t) => t.tipo === "expense");
    const smallExpenses = allExpenses.filter((t) => Number(t.valor) < 50);
    const indicadorImpulsividade =
      allExpenses.length > 0
        ? Math.round((smallExpenses.length / allExpenses.length) * 100) / 100
        : 0;

    // variabilidadeGastos: coeficiente de variação das despesas mensais
    const monthlyExpenses = monthList.map((m) => m.expense).filter((v) => v > 0);
    let variabilidadeGastos = 0;
    if (monthlyExpenses.length >= 3) {
      const mean = monthlyExpenses.reduce((s, v) => s + v, 0) / monthlyExpenses.length;
      const variance =
        monthlyExpenses.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / monthlyExpenses.length;
      variabilidadeGastos = mean > 0 ? Math.round((Math.sqrt(variance) / mean) * 100) / 100 : 0;
    }

    // indicadorEvitacao, hasCriticalAlerts, reservaBaixaMeta, comprometimentoMetas:
    // não disponíveis a partir de transações confirmadas.
    // Passamos valores neutros — o arquétipo pode ficar "indefinido", o que é aceitável.
    const { arquetipoFinanceiro, arquetipoDescricao } = buildArchetype({
      monthsWithData,
      avgSavingsRate,
      consistenciaRegistro,
      indicadorEvitacao: 0,
      indicadorImpulsividade,
      variabilidadeGastos,
      hasCriticalAlerts: false,
      reservaBaixaMeta: false,
      comprometimentoMetas: 0,
    });

    return {
      arquetipo: arquetipoFinanceiro,
      arquetipoDescricao,
      topCategorias,
      faixasTipicas,
      beneficiariosFrequentes,
      padraoTemporal: { horarioMaisAtivo: "indefinido", diaSemanaMaisAtivo: null },
    };
  } catch {
    // Falha silenciosa: contexto comportamental é enriquecimento opcional
    return SNAPSHOT_BLANK;
  }
}
