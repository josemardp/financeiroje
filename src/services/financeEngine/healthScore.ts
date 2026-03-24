import type { HealthScoreInput, HealthScoreResult, HealthRecommendation } from "./types";

/**
 * Calcula o Score de Saúde Financeira deterministicamente.
 * Cada componente vale 0-100. Score geral = média ponderada.
 *
 * HARDENING: componentes sem dado real retornam null e são excluídos
 * da média ponderada. Se dados insuficientes, scoreGeral = null.
 */
export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const comprometimentoRenda = input.totalIncome > 0 ? calcComprometimento(input.totalIncome, input.totalExpense) : null;
  const reservaEmergencia = input.emergencyReserveConfigured ? calcReserva(input.emergencyReserve, input.totalExpense) : null;
  const controleOrcamento = input.budgetConfigured ? calcControleOrcamento(input.budgetDeviation) : null;
  const adimplencia = input.totalInstallments > 0 ? calcAdimplencia(input.overdueInstallments, input.totalInstallments) : null;
  const regularidade = input.totalMonthsPossible > 1 ? calcRegularidade(input.monthsWithData, input.totalMonthsPossible) : null;

  // Weighted average only over available components
  const components: Array<{ value: number | null; weight: number }> = [
    { value: comprometimentoRenda, weight: 0.25 },
    { value: reservaEmergencia, weight: 0.25 },
    { value: controleOrcamento, weight: 0.20 },
    { value: adimplencia, weight: 0.20 },
    { value: regularidade, weight: 0.10 },
  ];

  const available = components.filter(c => c.value !== null);
  let scoreGeral: number | null = null;

  if (available.length > 0) {
    const totalWeight = available.reduce((s, c) => s + c.weight, 0);
    const weightedSum = available.reduce((s, c) => s + (c.value! * c.weight), 0);
    scoreGeral = round2(weightedSum / totalWeight);
  }

  const recommendations = buildRecommendations({
    comprometimentoRenda,
    reservaEmergencia,
    controleOrcamento,
    adimplencia,
    regularidade,
  });

  return {
    scoreGeral,
    comprometimentoRenda,
    reservaEmergencia,
    controleOrcamento,
    adimplencia,
    regularidade,
    recommendations,
    availableComponents: available.length,
    totalComponents: components.length,
  };
}

function calcComprometimento(income: number, expense: number): number {
  if (income <= 0) return 0;
  const ratio = expense / income;
  if (ratio <= 0.5) return 100;
  if (ratio <= 0.7) return 80;
  if (ratio <= 0.85) return 60;
  if (ratio <= 1.0) return 40;
  return Math.max(0, 20 - (ratio - 1) * 100);
}

function calcReserva(reserve: number, monthlyExpense: number): number {
  if (monthlyExpense <= 0) return reserve > 0 ? 100 : 50;
  const months = reserve / monthlyExpense;
  if (months >= 6) return 100;
  if (months >= 3) return 70;
  if (months >= 1) return 40;
  return Math.max(0, round2(months * 40));
}

function calcControleOrcamento(budgetDeviationPercent: number): number {
  if (budgetDeviationPercent <= 0) return 100;
  if (budgetDeviationPercent <= 5) return 90;
  if (budgetDeviationPercent <= 10) return 70;
  if (budgetDeviationPercent <= 20) return 50;
  if (budgetDeviationPercent <= 50) return 30;
  return 10;
}

function calcAdimplencia(overdue: number, total: number): number {
  if (total === 0) return 100;
  if (overdue === 0) return 100;
  const ratio = overdue / total;
  return Math.max(0, round2((1 - ratio) * 100));
}

function calcRegularidade(monthsWithData: number, totalMonths: number): number {
  if (totalMonths <= 0) return 50;
  return Math.min(100, round2((monthsWithData / totalMonths) * 100));
}

function buildRecommendations(scores: Record<string, number | null>): HealthRecommendation[] {
  const recs: HealthRecommendation[] = [];

  const check = (component: string, score: number | null, messages: Record<string, [string, HealthRecommendation["severity"]]>, unavailableMsg?: string) => {
    if (score === null) {
      if (unavailableMsg) {
        recs.push({ component, score: null, message: unavailableMsg, severity: "info" });
      }
      return;
    }
    for (const [threshold, [message, severity]] of Object.entries(messages).sort(([a], [b]) => Number(a) - Number(b))) {
      if (score <= Number(threshold)) {
        recs.push({ component, score, message, severity });
        return;
      }
    }
    recs.push({ component, score, message: "Excelente! Continue assim.", severity: "ok" });
  };

  check("comprometimentoRenda", scores.comprometimentoRenda, {
    40: ["Suas despesas superam ou se aproximam da renda. Revise gastos urgentemente.", "critical"],
    60: ["Comprometimento alto da renda. Busque reduzir despesas não essenciais.", "warning"],
    80: ["Bom controle, mas há margem para melhorar a economia.", "info"],
  }, "Sem receitas confirmadas para avaliar comprometimento da renda.");

  check("reservaEmergencia", scores.reservaEmergencia, {
    40: ["Reserva de emergência insuficiente. Priorize construir pelo menos 1 mês de despesas.", "critical"],
    70: ["Reserva parcial. O ideal são 6 meses de despesas como colchão.", "warning"],
  }, "Reserva de emergência não configurada. Configure nas preferências para ativar esta análise.");

  check("controleOrcamento", scores.controleOrcamento, {
    30: ["Orçamento muito estourado. Revise categorias com maior desvio.", "critical"],
    50: ["Desvio significativo no orçamento. Ajuste os limites ou reduza gastos.", "warning"],
    70: ["Pequenos desvios no orçamento. Monitore categorias específicas.", "info"],
  }, "Nenhum orçamento configurado para este mês. Crie um orçamento para ativar esta análise.");

  check("adimplencia", scores.adimplencia, {
    50: ["Parcelas em atraso detectadas. Regularize para evitar juros.", "critical"],
    80: ["Algumas pendências. Mantenha as parcelas em dia.", "warning"],
  });

  check("regularidade", scores.regularidade, {
    50: ["Poucos meses com dados. Use o sistema regularmente para melhor análise.", "info"],
  });

  return recs;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
