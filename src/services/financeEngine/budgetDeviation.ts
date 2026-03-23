import type { BudgetRaw, TransactionRaw, BudgetDeviationResult, BudgetDeviationItem, BudgetStatus } from "./types";

/**
 * Calcula o desvio orçamentário por categoria para um mês/ano específico.
 * Função PURA.
 */
export function calculateBudgetDeviation(
  budgets: BudgetRaw[],
  transactions: TransactionRaw[],
  month: number,
  year: number
): BudgetDeviationResult {
  if (!budgets || budgets.length === 0) {
    return {
      items: [],
      totalPlanned: 0,
      totalActual: 0,
      totalDeviationAbsolute: 0,
      totalDeviationPercent: 0,
      overallStatus: "ok",
    };
  }

  // Filter transactions for the given month/year and only expenses
  const monthTransactions = transactions.filter((t) => {
    if (t.tipo !== "expense") return false;
    const d = new Date(t.data);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  // Aggregate actual spending by category
  const actualByCategory = new Map<string, number>();
  for (const t of monthTransactions) {
    const key = t.categoria_id || "__none__";
    actualByCategory.set(key, (actualByCategory.get(key) || 0) + Number(t.valor));
  }

  const items: BudgetDeviationItem[] = budgets
    .filter((b) => b.mes === month && b.ano === year)
    .map((b) => {
      const key = b.categoria_id || "__none__";
      const planned = Number(b.valor_planejado) || 0;
      const actual = round2(actualByCategory.get(key) || 0);
      const deviationAbsolute = round2(actual - planned);
      const deviationPercent = planned > 0 ? round2((deviationAbsolute / planned) * 100) : actual > 0 ? 100 : 0;
      const status = getStatus(deviationPercent);

      return {
        categoryId: b.categoria_id,
        categoryName: b.categoria_nome || "Sem categoria",
        categoryIcon: b.categoria_icone || "📋",
        planned: round2(planned),
        actual,
        deviationAbsolute,
        deviationPercent,
        status,
      };
    });

  const totalPlanned = round2(items.reduce((s, i) => s + i.planned, 0));
  const totalActual = round2(items.reduce((s, i) => s + i.actual, 0));
  const totalDeviationAbsolute = round2(totalActual - totalPlanned);
  const totalDeviationPercent = totalPlanned > 0 ? round2((totalDeviationAbsolute / totalPlanned) * 100) : 0;

  return {
    items,
    totalPlanned,
    totalActual,
    totalDeviationAbsolute,
    totalDeviationPercent,
    overallStatus: getStatus(totalDeviationPercent),
  };
}

function getStatus(deviationPercent: number): BudgetStatus {
  if (deviationPercent > 10) return "exceeded";
  if (deviationPercent > 0) return "warning";
  return "ok";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
