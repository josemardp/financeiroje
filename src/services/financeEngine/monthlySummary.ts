import type { TransactionRaw, MonthlySummary, CategoryAmount } from "./types";

/**
 * Calcula o resumo financeiro mensal a partir de transações brutas.
 * Função PURA — sem efeitos colaterais, sem dependência de React/Supabase.
 *
 * REGRA DE HARDENING (PRD v3 §5):
 *  Esta função processa TODAS as transações recebidas. O CHAMADOR é responsável
 *  por pré-filtrar conforme o contexto:
 *    - Para KPIs oficiais: passar apenas filterOfficialTransactions(txns)
 *    - Para visão completa: passar todas e usar confirmedCount/suggestedCount
 *  A função reporta contagens por status para transparência.
 */
export function calculateMonthlySummary(transactions: TransactionRaw[]): MonthlySummary {
  if (!transactions || transactions.length === 0) {
    return {
      totalIncome: 0,
      totalExpense: 0,
      balance: 0,
      savingsRate: 0,
      expenseByCategory: [],
      incomeByCategory: [],
      transactionCount: 0,
      confirmedCount: 0,
      suggestedCount: 0,
    };
  }

  let totalIncome = 0;
  let totalExpense = 0;
  let confirmedCount = 0;
  let suggestedCount = 0;

  const expenseMap = new Map<string, { name: string; icon: string; total: number; count: number }>();
  const incomeMap = new Map<string, { name: string; icon: string; total: number; count: number }>();

  for (const t of transactions) {
    const valor = Number(t.valor) || 0;

    if (t.data_status === "confirmed" || t.data_status === null) confirmedCount++;
    if (t.data_status === "suggested") suggestedCount++;

    if (t.tipo === "income") {
      totalIncome += valor;
      accumulateCategory(incomeMap, t, valor);
    } else {
      totalExpense += valor;
      accumulateCategory(expenseMap, t, valor);
    }
  }

  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (balance / totalIncome) * 100 : 0;

  return {
    totalIncome: round2(totalIncome),
    totalExpense: round2(totalExpense),
    balance: round2(balance),
    savingsRate: round2(savingsRate),
    expenseByCategory: mapToArray(expenseMap, totalExpense),
    incomeByCategory: mapToArray(incomeMap, totalIncome),
    transactionCount: transactions.length,
    confirmedCount,
    suggestedCount,
  };
}

function accumulateCategory(
  map: Map<string, { name: string; icon: string; total: number; count: number }>,
  t: TransactionRaw,
  valor: number
) {
  const key = t.categoria_id || "__sem_categoria__";
  const existing = map.get(key);
  if (existing) {
    existing.total += valor;
    existing.count++;
  } else {
    map.set(key, {
      name: t.categoria_nome || "Sem categoria",
      icon: t.categoria_icone || "📋",
      total: valor,
      count: 1,
    });
  }
}

function mapToArray(
  map: Map<string, { name: string; icon: string; total: number; count: number }>,
  grandTotal: number
): CategoryAmount[] {
  return Array.from(map.entries())
    .map(([categoryId, data]) => ({
      categoryId: categoryId === "__sem_categoria__" ? null : categoryId,
      categoryName: data.name,
      categoryIcon: data.icon,
      total: round2(data.total),
      count: data.count,
      percentage: grandTotal > 0 ? round2((data.total / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
