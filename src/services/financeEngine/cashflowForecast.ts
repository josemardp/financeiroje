import type { CashflowForecastInput, CashflowForecastResult, ForecastHorizon, RecurringRaw, InstallmentRaw } from "./types";

/**
 * Calcula a previsão de caixa para 7, 30 e 90 dias.
 * Baseado em recorrências confirmadas + parcelas pendentes + padrões.
 * Função PURA.
 */
export function calculateCashflowForecast(input: CashflowForecastInput): CashflowForecastResult {
  const { currentBalance, recurringTransactions, upcomingInstallments } = input;
  const assumptions: string[] = [];
  const warnings: string[] = [];

  const activeRecurrences = (recurringTransactions || []).filter((r) => r.ativa !== false);

  if (activeRecurrences.length === 0) {
    assumptions.push("Nenhuma recorrência ativa cadastrada — previsão limitada.");
  } else {
    assumptions.push(`${activeRecurrences.length} recorrência(s) ativa(s) considerada(s).`);
  }

  if (upcomingInstallments && upcomingInstallments.length > 0) {
    assumptions.push(`${upcomingInstallments.length} parcela(s) pendente(s) incluída(s).`);
  }

  const horizons: ForecastHorizon[] = [7, 30, 90].map((days) => {
    const { inflows, outflows } = projectRecurrences(activeRecurrences, days);
    const installmentOutflow = projectInstallments(upcomingInstallments || [], days);

    const totalInflows = round2(inflows);
    const totalOutflows = round2(outflows + installmentOutflow);
    const projectedBalance = round2(currentBalance + totalInflows - totalOutflows);

    const confidenceLevel = days <= 7 ? "alta" : days <= 30 ? "media" : "baixa";

    if (projectedBalance < 0) {
      warnings.push(`Saldo projetado negativo em ${days} dias: R$ ${projectedBalance.toFixed(2)}`);
    }

    return {
      days,
      label: `${days} dias`,
      projectedBalance,
      totalInflows,
      totalOutflows,
      confidenceLevel,
    };
  });

  assumptions.push("O 'saldo líquido do mês' é receitas menos despesas confirmadas do mês corrente. Não é saldo bancário real.");

  return { currentMonthlyBalance: round2(currentBalance), horizons, assumptions, warnings };
}

function projectRecurrences(recurrences: RecurringRaw[], days: number): { inflows: number; outflows: number } {
  let inflows = 0;
  let outflows = 0;

  const today = new Date();

  for (const r of recurrences) {
    const valor = Number(r.valor) || 0;
    const occurrences = estimateOccurrences(r, days, today);

    if (r.tipo === "income") {
      inflows += valor * occurrences;
    } else {
      outflows += valor * occurrences;
    }
  }

  return { inflows, outflows };
}

/**
 * Estima quantas vezes uma recorrência ocorre em `days` dias a partir de `from`.
 *
 * HARDENING: reescrito para corrigir bugs em bordas de calendário.
 * - monthly: itera mês a mês verificando se dia_mes cai no intervalo
 * - biweekly: usa divisão exata por 14
 * - yearly/semiannual/quarterly: conta datas reais no intervalo
 */
function estimateOccurrences(r: RecurringRaw, days: number, from: Date): number {
  const freq = r.frequencia || "monthly";

  const endDate = new Date(from);
  endDate.setDate(endDate.getDate() + days);

  // For monthly with dia_mes, count actual calendar occurrences
  if (freq === "monthly" && r.dia_mes) {
    return countMonthlyOccurrences(r.dia_mes, from, endDate);
  }

  // For quarterly/semiannual/yearly with dia_mes, count by stepping months
  if (r.dia_mes && (freq === "quarterly" || freq === "semiannual" || freq === "yearly")) {
    const stepMonths = freq === "quarterly" ? 3 : freq === "semiannual" ? 6 : 12;
    return countPeriodicMonthlyOccurrences(r.dia_mes, stepMonths, from, endDate);
  }

  // For simple period-based frequencies, use division
  const periodDays: Record<string, number> = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 91,
    semiannual: 182,
    yearly: 365,
  };
  const period = periodDays[freq] || 30;
  return Math.max(0, Math.floor(days / period));
}

/** Conta quantas vezes o dia `dayOfMonth` cai entre from e endDate (exclusive) */
function countMonthlyOccurrences(dayOfMonth: number, from: Date, endDate: Date): number {
  let count = 0;
  // Start from the month of `from`
  let year = from.getFullYear();
  let month = from.getMonth();

  // Check up to (days/28 + 2) months to be safe
  const maxIterations = Math.ceil((endDate.getTime() - from.getTime()) / (28 * 86400000)) + 2;

  for (let i = 0; i < maxIterations; i++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const effectiveDay = Math.min(dayOfMonth, daysInMonth);
    const candidate = new Date(year, month, effectiveDay);

    if (candidate > from && candidate <= endDate) {
      count++;
    }
    if (candidate > endDate) break;

    month++;
    if (month > 11) { month = 0; year++; }
  }
  return count;
}

/** Conta ocorrências para frequências que pulam N meses (quarterly, semiannual, yearly) */
function countPeriodicMonthlyOccurrences(dayOfMonth: number, stepMonths: number, from: Date, endDate: Date): number {
  let count = 0;
  let year = from.getFullYear();
  let month = from.getMonth();
  const maxIterations = Math.ceil((endDate.getTime() - from.getTime()) / (28 * stepMonths * 86400000)) + 2;

  for (let i = 0; i < maxIterations; i++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const effectiveDay = Math.min(dayOfMonth, daysInMonth);
    const candidate = new Date(year, month, effectiveDay);

    if (candidate > from && candidate <= endDate) {
      count++;
    }
    if (candidate > endDate) break;

    month += stepMonths;
    while (month > 11) { month -= 12; year++; }
  }
  return count;
}

function projectInstallments(installments: InstallmentRaw[], days: number): number {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  let total = 0;
  for (const inst of installments) {
    if (inst.status === "pago") continue;
    const vencimento = new Date(inst.data_vencimento);
    if (vencimento >= today && vencimento <= endDate) {
      total += Number(inst.valor) || 0;
    }
  }
  return total;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
