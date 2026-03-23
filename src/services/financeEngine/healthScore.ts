import type { HealthScoreInput, HealthScoreResult, HealthRecommendation } from "./types";

/**
 * Calcula o Score de Saúde Financeira deterministicamente.
 * Cada componente vale 0-100. Score geral = média ponderada.
 */
export function calculateHealthScore(input: HealthScoreInput): HealthScoreResult {
  const comprometimentoRenda = calcComprometimento(input.totalIncome, input.totalExpense);
  const reservaEmergencia = calcReserva(input.emergencyReserve, input.totalExpense);
  const controleOrcamento = calcControleOrcamento(input.budgetDeviation);
  const adimplencia = calcAdimplencia(input.overdueInstallments, input.totalInstallments);
  const regularidade = calcRegularidade(input.monthsWithData, input.totalMonthsPossible);

  // Pesos PRD: comprometimento=25, reserva=25, orçamento=20, adimplência=20, regularidade=10
  const scoreGeral = round2(
    comprometimentoRenda * 0.25 +
    reservaEmergencia * 0.25 +
    controleOrcamento * 0.20 +
    adimplencia * 0.20 +
    regularidade * 0.10
  );

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
  };
}

/** Quanto menor o comprometimento da renda, melhor o score */
function calcComprometimento(income: number, expense: number): number {
  if (income <= 0) return 0;
  const ratio = expense / income;
  if (ratio <= 0.5) return 100;
  if (ratio <= 0.7) return 80;
  if (ratio <= 0.85) return 60;
  if (ratio <= 1.0) return 40;
  return Math.max(0, 20 - (ratio - 1) * 100);
}

/** Reserva ideal = 6x despesas mensais */
function calcReserva(reserve: number, monthlyExpense: number): number {
  if (monthlyExpense <= 0) return reserve > 0 ? 100 : 50;
  const months = reserve / monthlyExpense;
  if (months >= 6) return 100;
  if (months >= 3) return 70;
  if (months >= 1) return 40;
  return Math.max(0, round2(months * 40));
}

/** Quanto menor o desvio orçamentário, melhor */
function calcControleOrcamento(budgetDeviationPercent: number): number {
  if (budgetDeviationPercent <= 0) return 100;
  if (budgetDeviationPercent <= 5) return 90;
  if (budgetDeviationPercent <= 10) return 70;
  if (budgetDeviationPercent <= 20) return 50;
  if (budgetDeviationPercent <= 50) return 30;
  return 10;
}

/** Quanto menos parcelas vencidas, melhor */
function calcAdimplencia(overdue: number, total: number): number {
  if (total === 0) return 100; // sem dívidas = adimplência perfeita
  if (overdue === 0) return 100;
  const ratio = overdue / total;
  return Math.max(0, round2((1 - ratio) * 100));
}

/** Regularidade de uso do sistema */
function calcRegularidade(monthsWithData: number, totalMonths: number): number {
  if (totalMonths <= 0) return 50;
  return Math.min(100, round2((monthsWithData / totalMonths) * 100));
}

function buildRecommendations(scores: Record<string, number>): HealthRecommendation[] {
  const recs: HealthRecommendation[] = [];

  const check = (component: string, score: number, messages: Record<string, [string, HealthRecommendation["severity"]]>) => {
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
  });

  check("reservaEmergencia", scores.reservaEmergencia, {
    40: ["Reserva de emergência insuficiente. Priorize construir pelo menos 1 mês de despesas.", "critical"],
    70: ["Reserva parcial. O ideal são 6 meses de despesas como colchão.", "warning"],
  });

  check("controleOrcamento", scores.controleOrcamento, {
    30: ["Orçamento muito estourado. Revise categorias com maior desvio.", "critical"],
    50: ["Desvio significativo no orçamento. Ajuste os limites ou reduza gastos.", "warning"],
    70: ["Pequenos desvios no orçamento. Monitore categorias específicas.", "info"],
  });

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
