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

  return { currentBalance: round2(currentBalance), horizons, assumptions, warnings };
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

function estimateOccurrences(r: RecurringRaw, days: number, from: Date): number {
  const freq = r.frequencia || "monthly";
  const periodDays: Record<string, number> = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 90,
    semiannual: 180,
    yearly: 365,
  };

  const period = periodDays[freq] || 30;

  if (freq === "monthly" && r.dia_mes) {
    // Count how many times dia_mes falls within `days` from `from`
    let count = 0;
    const d = new Date(from);
    for (let i = 0; i < days; i++) {
      d.setDate(d.getDate() + (i === 0 ? 0 : 1));
      if (d.getDate() === r.dia_mes) count++;
      if (i === 0) d.setDate(d.getDate() + 1); // advance for first iteration
    }
    // Fallback: at least estimate by division
    return count || Math.max(0, Math.floor(days / period));
  }

  return Math.max(0, Math.floor(days / period));
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
