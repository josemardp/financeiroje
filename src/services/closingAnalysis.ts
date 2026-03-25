/**
 * FinanceAI — Análise de Fechamento Mensal
 * Funções puras para gerar insights executivos a partir dos dados da engine.
 * Sem dependência de React/Supabase. Patch mínimo.
 */
import type { MonthlySummary, BudgetDeviationResult, BudgetDeviationItem, GoalProgressResult } from "./financeEngine/types";

// ─── Inputs opcionais de metas e reserva ─────────────────────────

export interface GoalClosingInput {
  atRisk: { name: string; progressPercent: number; monthlyNeeded: number | null }[];
  totalActive: number;
}

export interface ReserveClosingInput {
  currentValue: number;
  targetMonths: number;
  monthlyExpense: number;
  coverageMonths: number;
  configured: boolean;
}

// ─── Resumo Executivo ────────────────────────────────────────────

export type MonthVerdict = "positivo" | "neutro" | "pressao" | "atencao";

export interface ExecutiveSummary {
  verdict: MonthVerdict;
  verdictLabel: string;
  verdictDescription: string;
  savingsRate: number;
}

export function buildExecutiveSummary(summary: MonthlySummary): ExecutiveSummary {
  const { balance, savingsRate, totalIncome, totalExpense } = summary;

  let verdict: MonthVerdict;
  let verdictLabel: string;
  let verdictDescription: string;

  if (totalIncome === 0 && totalExpense === 0) {
    verdict = "neutro";
    verdictLabel = "Sem movimentação";
    verdictDescription = "Nenhuma transação confirmada neste mês.";
  } else if (savingsRate >= 15) {
    verdict = "positivo";
    verdictLabel = "Mês positivo";
    verdictDescription = `Sobrou ${savingsRate.toFixed(0)}% da receita. Bom ritmo de poupança.`;
  } else if (savingsRate >= 0) {
    verdict = "atencao";
    verdictLabel = "Resultado apertado";
    verdictDescription = balance > 0
      ? `Saldo positivo, mas margem de ${savingsRate.toFixed(0)}% é baixa.`
      : "Receitas e despesas praticamente empataram.";
  } else {
    verdict = "pressao";
    verdictLabel = "Pressão financeira";
    verdictDescription = `Despesas superaram receitas. Déficit no mês.`;
  }

  return { verdict, verdictLabel, verdictDescription, savingsRate };
}

// ─── Principais Desvios ──────────────────────────────────────────

export interface MonthDeviation {
  type: "budget_exceeded" | "budget_warning" | "high_pending" | "no_category";
  label: string;
  detail: string;
  severity: "critical" | "warning" | "info";
}

export function buildDeviations(
  summary: MonthlySummary,
  budget: BudgetDeviationResult | null,
  pendingCount: number,
  noCategoryCount: number,
  goals?: GoalClosingInput | null,
  reserve?: ReserveClosingInput | null,
): MonthDeviation[] {
  const deviations: MonthDeviation[] = [];

  // Budget exceeded items (top 2)
  if (budget) {
    const exceeded = budget.items
      .filter(i => i.status === "exceeded")
      .sort((a, b) => b.deviationPercent - a.deviationPercent)
      .slice(0, 2);

    for (const item of exceeded) {
      deviations.push({
        type: "budget_exceeded",
        label: `${item.categoryIcon} ${item.categoryName} estourou`,
        detail: `+${item.deviationPercent.toFixed(0)}% acima do planejado`,
        severity: "critical",
      });
    }

    const warnings = budget.items
      .filter(i => i.status === "warning")
      .sort((a, b) => b.deviationPercent - a.deviationPercent)
      .slice(0, 1);

    for (const item of warnings) {
      deviations.push({
        type: "budget_warning",
        label: `${item.categoryIcon} ${item.categoryName} no limite`,
        detail: `${item.deviationPercent.toFixed(0)}% do orçamento usado`,
        severity: "warning",
      });
    }
  }

  if (pendingCount >= 3) {
    deviations.push({
      type: "high_pending",
      label: `${pendingCount} pendências no mês`,
      detail: "Transações não confirmadas podem alterar o resultado",
      severity: "warning",
    });
  }

  if (noCategoryCount >= 3) {
    deviations.push({
      type: "no_category",
      label: `${noCategoryCount} sem categoria`,
      detail: "Dificulta análise por categoria e orçamento",
      severity: "info",
    });
  }

  // Meta em risco
  if (goals && goals.atRisk.length > 0) {
    const top = goals.atRisk[0];
    deviations.push({
      type: "budget_warning",
      label: `🎯 Meta "${top.name}" em risco`,
      detail: `Apenas ${top.progressPercent.toFixed(0)}% atingido${top.monthlyNeeded ? ` — precisa de R$ ${top.monthlyNeeded.toFixed(0)}/mês` : ""}`,
      severity: "warning",
    });
  }

  // Reserva abaixo da meta
  if (reserve && reserve.configured && reserve.coverageMonths < reserve.targetMonths) {
    deviations.push({
      type: "budget_warning",
      label: `🛡️ Reserva abaixo da meta`,
      detail: `${reserve.coverageMonths.toFixed(1)} meses cobertos de ${reserve.targetMonths} planejados`,
      severity: reserve.coverageMonths < 1 ? "critical" : "warning",
    });
  }

  return deviations;
}

// ─── Confiabilidade ──────────────────────────────────────────────

export type ReliabilityLevel = "confiavel" | "parcial" | "baixa";

export interface ReliabilityResult {
  level: ReliabilityLevel;
  label: string;
  description: string;
  pendingCount: number;
  noCategoryCount: number;
  totalTransactions: number;
}

export function buildReliability(
  totalTransactions: number,
  pendingCount: number,
  noCategoryCount: number,
): ReliabilityResult {
  const pendingRatio = totalTransactions > 0 ? pendingCount / totalTransactions : 0;

  let level: ReliabilityLevel;
  let label: string;
  let description: string;

  if (pendingCount === 0 && noCategoryCount <= 1) {
    level = "confiavel";
    label = "Confiável";
    description = "Todos os dados estão confirmados e categorizados.";
  } else if (pendingRatio <= 0.15 && noCategoryCount <= 3) {
    level = "parcial";
    label = "Parcialmente confiável";
    description = `${pendingCount} pendência(s) e ${noCategoryCount} sem categoria podem afetar o resultado.`;
  } else {
    level = "baixa";
    label = "Baixa confiabilidade";
    description = `Muitas transações pendentes ou sem categoria. Revise antes de fechar.`;
  }

  return { level, label, description, pendingCount, noCategoryCount, totalTransactions };
}

// ─── Leitura do Mês ──────────────────────────────────────────────

export interface MonthReading {
  positivePoint: string | null;
  attentionPoint: string | null;
  biggestPressure: string | null;
}

export function buildMonthReading(
  summary: MonthlySummary,
  budget: BudgetDeviationResult | null,
  pendingCount: number,
  goals?: GoalClosingInput | null,
  reserve?: ReserveClosingInput | null,
): MonthReading {
  let positivePoint: string | null = null;
  let attentionPoint: string | null = null;
  let biggestPressure: string | null = null;

  // Positive
  if (summary.savingsRate >= 20) {
    positivePoint = `Taxa de poupança de ${summary.savingsRate.toFixed(0)}% — acima da referência.`;
  } else if (summary.balance > 0) {
    positivePoint = "Mês fechou com saldo positivo.";
  }

  // Budget OK categories
  if (budget) {
    const okCount = budget.items.filter(i => i.status === "ok").length;
    if (okCount > 0 && !positivePoint) {
      positivePoint = `${okCount} categoria(s) dentro do orçamento.`;
    }
  }

  // Attention
  if (pendingCount > 0) {
    attentionPoint = `${pendingCount} transação(ões) pendente(s) de confirmação.`;
  } else if (summary.savingsRate < 5 && summary.savingsRate >= 0) {
    attentionPoint = "Margem de poupança muito baixa.";
  }

  // Pressure
  if (summary.expenseByCategory.length > 0) {
    const top = summary.expenseByCategory[0];
    biggestPressure = `${top.categoryIcon} ${top.categoryName} representa ${top.percentage.toFixed(0)}% das despesas.`;
  }

  if (budget) {
    const worstExceeded = budget.items
      .filter(i => i.status === "exceeded")
      .sort((a, b) => b.deviationAbsolute - a.deviationAbsolute)[0];
    if (worstExceeded) {
      biggestPressure = `${worstExceeded.categoryIcon} ${worstExceeded.categoryName} ultrapassou o orçamento em ${worstExceeded.deviationPercent.toFixed(0)}%.`;
    }
  }

  // Enriquecer com metas e reserva
  if (goals && goals.atRisk.length > 0 && !attentionPoint) {
    attentionPoint = `Meta "${goals.atRisk[0].name}" está com apenas ${goals.atRisk[0].progressPercent.toFixed(0)}% de progresso.`;
  }

  if (reserve && reserve.configured && reserve.coverageMonths < reserve.targetMonths && !attentionPoint) {
    attentionPoint = `Reserva de emergência cobre ${reserve.coverageMonths.toFixed(1)} meses (meta: ${reserve.targetMonths}).`;
  }

  return { positivePoint, attentionPoint, biggestPressure };
}

// ─── Foco do Próximo Mês ────────────────────────────────────────

export interface NextMonthFocus {
  primary: string;
  secondary: string[];
}

export function buildNextMonthFocus(
  summary: MonthlySummary,
  budget: BudgetDeviationResult | null,
  pendingCount: number,
  reliability: ReliabilityResult,
): NextMonthFocus {
  const secondary: string[] = [];
  let primary: string;

  // Primary focus
  if (summary.balance < 0) {
    primary = "Reverter o déficit: reduzir despesas ou aumentar receitas.";
  } else if (reliability.level === "baixa") {
    primary = "Melhorar a qualidade dos dados: confirmar pendências e categorizar transações.";
  } else if (budget && budget.overallStatus === "exceeded") {
    primary = "Ajustar o orçamento ou reduzir gastos nas categorias estouradas.";
  } else if (summary.savingsRate < 10) {
    primary = "Aumentar a margem de poupança para pelo menos 10%.";
  } else {
    primary = "Manter o ritmo e consolidar os resultados positivos.";
  }

  // Secondary
  if (pendingCount > 0) {
    secondary.push("Resolver todas as pendências de transações.");
  }

  if (budget) {
    const exceeded = budget.items.filter(i => i.status === "exceeded");
    if (exceeded.length > 0) {
      secondary.push(`Revisar orçamento de ${exceeded.map(i => i.categoryName).join(", ")}.`);
    }
  }

  if (summary.savingsRate >= 15 && secondary.length === 0) {
    secondary.push("Considerar alocar parte da sobra para metas ou reserva.");
  }

  return { primary, secondary: secondary.slice(0, 2) };
}
