import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types Replicated from Frontend ────────────────────────────────

interface TransactionRaw {
  id: string;
  valor: number;
  tipo: "income" | "expense";
  data: string;
  descricao: string | null;
  categoria_id: string | null;
  categoria_nome?: string | null;
  categoria_icone?: string | null;
  categoria_is_business_cost?: boolean | null;
  scope: "private" | "family" | "business" | null;
  data_status: string | null;
  e_mei?: boolean | null;
}

interface BudgetRaw {
  id: string;
  categoria_id: string | null;
  categoria_nome?: string | null;
  categoria_icone?: string | null;
  valor_planejado: number;
  mes: number;
  ano: number;
  scope: "private" | "family" | "business" | null;
}

interface RecurringRaw {
  id: string;
  descricao: string;
  valor: number;
  tipo: "income" | "expense";
  frequencia: string | null;
  dia_mes: number | null;
  ativa: boolean | null;
  categoria_id: string | null;
}

interface LoanRaw {
  id: string;
  nome: string;
  valor_original: number;
  saldo_devedor: number | null;
  taxa_juros_mensal: number | null;
  cet_anual: number | null;
  parcelas_total: number | null;
  parcelas_restantes: number | null;
  valor_parcela: number | null;
  metodo_amortizacao: "price" | "sac" | null;
}

interface InstallmentRaw {
  id: string;
  emprestimo_id: string;
  numero: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string | null;
}

interface GoalRaw {
  id: string;
  nome: string;
  valor_alvo: number;
  valor_atual: number | null;
  prazo: string | null;
  prioridade: "alta" | "media" | "baixa" | null;
  ativo: boolean | null;
}

interface GoalContributionRaw {
  id: string;
  goal_id: string;
  valor: number;
  data: string;
}

// ─── Logic Functions (Pure) ────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Health Score Calculation */
function calculateHealthScore(input: any) {
  const calcComprometimento = (income: number, expense: number) => {
    if (income <= 0) return 0;
    const ratio = expense / income;
    if (ratio <= 0.5) return 100;
    if (ratio <= 0.7) return 80;
    if (ratio <= 0.85) return 60;
    if (ratio <= 1.0) return 40;
    return Math.max(0, 20 - (ratio - 1) * 100);
  };

  const calcReserva = (reserve: number, monthlyExpense: number) => {
    if (monthlyExpense <= 0) return reserve > 0 ? 100 : 50;
    const months = reserve / monthlyExpense;
    if (months >= 6) return 100;
    if (months >= 3) return 70;
    if (months >= 1) return 40;
    return Math.max(0, round2(months * 40));
  };

  const calcControleOrcamento = (budgetDeviationPercent: number) => {
    if (budgetDeviationPercent <= 0) return 100;
    if (budgetDeviationPercent <= 5) return 90;
    if (budgetDeviationPercent <= 10) return 70;
    if (budgetDeviationPercent <= 20) return 50;
    if (budgetDeviationPercent <= 50) return 30;
    return 10;
  };

  const calcAdimplencia = (overdue: number, total: number) => {
    if (total === 0) return 100;
    if (overdue === 0) return 100;
    const ratio = overdue / total;
    return Math.max(0, round2((1 - ratio) * 100));
  };

  const calcRegularidade = (monthsWithData: number, totalMonths: number) => {
    if (totalMonths <= 0) return 50;
    return Math.min(100, round2((monthsWithData / totalMonths) * 100));
  };

  const comprometimentoRenda = input.totalIncome > 0 ? calcComprometimento(input.totalIncome, input.totalExpense) : null;
  const reservaEmergencia = input.emergencyReserveConfigured ? calcReserva(input.emergencyReserve, input.totalExpense) : null;
  const controleOrcamento = input.budgetConfigured ? calcControleOrcamento(input.budgetDeviation) : null;
  const adimplencia = input.totalInstallments > 0 ? calcAdimplencia(input.overdueInstallments, input.totalInstallments) : null;
  const regularidade = input.totalMonthsPossible > 1 ? calcRegularidade(input.monthsWithData, input.totalMonthsPossible) : null;

  const components = [
    { value: comprometimentoRenda, weight: 0.25 },
    { value: reservaEmergencia, weight: 0.25 },
    { value: controleOrcamento, weight: 0.20 },
    { value: adimplencia, weight: 0.20 },
    { value: regularidade, weight: 0.10 },
  ];

  const available = components.filter(c => c.value !== null);
  let scoreGeral = null;

  if (available.length > 0) {
    const totalWeight = available.reduce((s, c) => s + c.weight, 0);
    const weightedSum = available.reduce((s, c) => s + (c.value! * c.weight), 0);
    scoreGeral = round2(weightedSum / totalWeight);
  }

  return {
    scoreGeral,
    comprometimentoRenda,
    reservaEmergencia,
    controleOrcamento,
    adimplencia,
    regularidade,
    availableComponents: available.length,
    totalComponents: components.length,
  };
}

/** Budget Deviation Calculation */
function calculateBudgetDeviation(budgets: BudgetRaw[], transactions: TransactionRaw[]) {
  const expenseTransactions = transactions.filter(t => t.tipo === "expense");
  const items = budgets.map(budget => {
    const categoryTxns = expenseTransactions.filter(t => t.categoria_id === budget.categoria_id);
    const actual = categoryTxns.filter(t => t.data_status === "confirmed" || !t.data_status).reduce((s, t) => s + Number(t.valor), 0);
    const suggestedActual = categoryTxns.filter(t => t.data_status === "suggested").reduce((s, t) => s + Number(t.valor), 0);
    const deviationAbsolute = actual - Number(budget.valor_planejado);
    const deviationPercent = budget.valor_planejado > 0 ? (deviationAbsolute / budget.valor_planejado) * 100 : 0;
    
    let status: "ok" | "warning" | "exceeded" = "ok";
    if (deviationPercent > 10) status = "exceeded";
    else if (deviationPercent > 0) status = "warning";

    return {
      categoryId: budget.categoria_id,
      categoryName: budget.categoria_nome || "Sem nome",
      categoryIcon: budget.categoria_icone || "📋",
      planned: Number(budget.valor_planejado),
      actual: round2(actual),
      suggestedActual: round2(suggestedActual),
      deviationAbsolute: round2(deviationAbsolute),
      deviationPercent: round2(deviationPercent),
      status
    };
  });

  const totalPlanned = budgets.reduce((s, b) => s + Number(b.valor_planejado), 0);
  const totalActual = items.reduce((s, i) => s + i.actual, 0);
  const totalDeviationAbsolute = totalActual - totalPlanned;
  const totalDeviationPercent = totalPlanned > 0 ? (totalDeviationAbsolute / totalPlanned) * 100 : 0;

  let overallStatus: "ok" | "warning" | "exceeded" = "ok";
  if (totalDeviationPercent > 5) overallStatus = "exceeded";
  else if (totalDeviationPercent > 0) overallStatus = "warning";

  return {
    items,
    totalPlanned: round2(totalPlanned),
    totalActual: round2(totalActual),
    totalDeviationAbsolute: round2(totalDeviationAbsolute),
    totalDeviationPercent: round2(totalDeviationPercent),
    overallStatus
  };
}

/** Cashflow Forecast Calculation */
function calculateCashflowForecast(input: any) {
  const { currentBalance, recurringTransactions, recentTransactions, upcomingInstallments } = input;
  
  const horizons = [
    { days: 7, label: "7 dias", weight: 1 },
    { days: 30, label: "30 dias", weight: 4 },
    { days: 90, label: "90 dias", weight: 12 },
  ].map(h => {
    let totalInflows = 0;
    let totalOutflows = 0;

    recurringTransactions.filter((r: any) => r.ativa).forEach((r: any) => {
      const occurrences = h.days / 30; 
      if (r.tipo === "income") totalInflows += r.valor * occurrences;
      else totalOutflows += r.valor * occurrences;
    });

    upcomingInstallments.filter((i: any) => {
      const dueDate = new Date(i.data_vencimento);
      const diff = (dueDate.getTime() - Date.now()) / (1000 * 3600 * 24);
      return diff >= 0 && diff <= h.days && !i.data_pagamento;
    }).forEach((i: any) => {
      totalOutflows += Number(i.valor);
    });

    return {
      days: h.days,
      label: h.label,
      projectedBalance: round2(currentBalance + totalInflows - totalOutflows),
      totalInflows: round2(totalInflows),
      totalOutflows: round2(totalOutflows),
      confidenceLevel: h.days <= 30 ? "alta" : "media"
    };
  });

  return {
    currentMonthlyBalance: round2(currentBalance),
    horizons,
    assumptions: ["Baseado em transações recorrentes e parcelas vindo do banco de dados."],
    warnings: horizons[0].projectedBalance < 0 ? ["Risco de saldo negativo nos próximos 7 dias!"] : []
  };
}

/** Goal Progress Calculation */
function calculateGoalProgress(goals: GoalRaw[], contributions: GoalContributionRaw[]) {
  return goals.map(goal => {
    const goalContributions = contributions.filter(c => c.goal_id === goal.id);
    const totalContributed = goalContributions.reduce((s, c) => s + Number(c.valor), 0);
    const currentVal = (Number(goal.valor_atual) || 0) + totalContributed;
    const progressPercent = goal.valor_alvo > 0 ? (currentVal / goal.valor_alvo) * 100 : 0;
    const remainingAmount = Math.max(0, goal.valor_alvo - currentVal);
    
    const projectedCompletionDate = null;
    let monthlyContributionNeeded = null;
    
    if (goal.prazo) {
      const targetDate = new Date(goal.prazo);
      const monthsLeft = (targetDate.getTime() - Date.now()) / (1000 * 3600 * 24 * 30);
      if (monthsLeft > 0) {
        monthlyContributionNeeded = round2(remainingAmount / monthsLeft);
      }
    }

    return {
      goalId: goal.id,
      goalName: goal.nome,
      progressPercent: round2(progressPercent),
      remainingAmount: round2(remainingAmount),
      projectedCompletionDate,
      monthlyContributionNeeded,
      isOnTrack: progressPercent > 0,
      totalContributed: round2(totalContributed)
    };
  });
}

/** Loan Indicators Calculation */
function calculateLoanIndicators(loans: LoanRaw[], installments: InstallmentRaw[]) {
  const results = loans.map(loan => {
    const loanInstallments = installments.filter(i => i.emprestimo_id === loan.id);
    const paidInstallments = loanInstallments.filter(i => i.status === "pago" || i.data_pagamento);
    const pendingInstallments = loanInstallments.filter(i => i.status !== "pago" && !i.data_pagamento);
    
    const totalJaPago = paidInstallments.reduce((s, i) => s + Number(i.valor), 0);
    const saldoAtual = Math.max(0, Number(loan.valor_original) - totalJaPago);
    const parcelasRestantes = Number(loan.parcelas_restantes) || pendingInstallments.length;
    const valorParcela = Number(loan.valor_parcela) || (pendingInstallments[0] ? Number(pendingInstallments[0].valor) : 0);
    const custoEstimadoRestante = round2(parcelasRestantes * valorParcela);
    
    const taxaMensal = Number(loan.taxa_juros_mensal) || 0;
    const impactoAmortizacaoExtra = taxaMensal > 0 && parcelasRestantes > 0
      ? round2(saldoAtual * (taxaMensal / 100) * parcelasRestantes * 0.5)
      : 0;

    return {
      loanId: loan.id,
      loanName: loan.nome,
      saldoAtual: round2(saldoAtual),
      parcelasRestantes,
      custoEstimadoRestante,
      totalJaPago: round2(totalJaPago),
      totalAPagar: round2(totalJaPago + custoEstimadoRestante),
      impactoAmortizacaoExtra,
      taxaMensal,
      cetAnual: Number(loan.cet_anual) || 0,
    };
  });

  return {
    loans: results,
    totalSaldoDevedor: round2(results.reduce((s, r) => s + r.saldoAtual, 0)),
    totalCustoRestante: round2(results.reduce((s, r) => s + r.custoEstimadoRestante, 0)),
    totalParcelas: results.reduce((s, r) => s + r.parcelasRestantes, 0),
  };
}

/** MEI Business Summary Calculation */
function calculateMeiSummary(transactions: TransactionRaw[], annualLimit: number = 81000) {
  // Filtrar apenas transações do escopo business
  const businessTxns = transactions.filter(t => t.scope === "business");
  
  let receitaBruta = 0;
  let custosOperacionais = 0;
  let despesasIndiretas = 0;
  
  businessTxns.forEach(t => {
    const valor = Number(t.valor) || 0;
    if (t.tipo === "income") {
      receitaBruta += valor;
    } else {
      // Se a categoria for marcada como custo ou se o campo e_mei for true (custo direto)
      if (t.categoria_is_business_cost || t.e_mei) {
        custosOperacionais += valor;
      } else {
        despesasIndiretas += valor;
      }
    }
  });

  const lucroOperacional = receitaBruta - custosOperacionais - despesasIndiretas;
  const percentualLimite = annualLimit > 0 ? (receitaBruta / annualLimit) * 100 : 0;
  
  let alertLevel: "info" | "warning" | "critical" = "info";
  if (percentualLimite >= 95) alertLevel = "critical";
  else if (percentualLimite >= 80) alertLevel = "warning";

  return {
    receitaBruta: round2(receitaBruta),
    custosOperacionais: round2(custosOperacionais),
    despesasIndiretas: round2(despesasIndiretas),
    lucroOperacional: round2(lucroOperacional),
    margemLucro: receitaBruta > 0 ? round2((lucroOperacional / receitaBruta) * 100) : 0,
    percentualLimite: round2(percentualLimite),
    limiteAnual: annualLimit,
    valorRestanteLimite: round2(Math.max(0, annualLimit - receitaBruta)),
    alertLevel,
    businessTransactionCount: businessTxns.length
  };
}

/** Monthly Summary Calculation */
function calculateMonthlySummary(transactions: TransactionRaw[]) {
  let totalIncome = 0;
  let totalExpense = 0;
  let confirmedCount = 0;
  let suggestedCount = 0;
  
  const expenseMap = new Map();
  const incomeMap = new Map();

  transactions.forEach(t => {
    const valor = Number(t.valor) || 0;
    if (t.data_status === "confirmed" || !t.data_status) confirmedCount++;
    if (t.data_status === "suggested") suggestedCount++;
    
    if (t.tipo === "income") {
      totalIncome += valor;
      const key = t.categoria_id || "sem_categoria";
      const existing = incomeMap.get(key) || { name: t.categoria_nome || "Sem categoria", icon: t.categoria_icone || "📋", total: 0, count: 0 };
      existing.total += valor;
      existing.count++;
      incomeMap.set(key, existing);
    } else {
      totalExpense += valor;
      const key = t.categoria_id || "sem_categoria";
      const existing = expenseMap.get(key) || { name: t.categoria_nome || "Sem categoria", icon: t.categoria_icone || "📋", total: 0, count: 0 };
      existing.total += valor;
      existing.count++;
      expenseMap.set(key, existing);
    }
  });

  const mapToArray = (map: Map<string, any>, total: number) => {
    return Array.from(map.entries()).map(([id, data]) => ({
      categoryId: id === "sem_categoria" ? null : id,
      categoryName: data.name,
      categoryIcon: data.icon,
      total: round2(data.total),
      count: data.count,
      percentage: total > 0 ? round2((data.total / total) * 100) : 0
    })).sort((a, b) => b.total - a.total);
  };

  return {
    totalIncome: round2(totalIncome),
    totalExpense: round2(totalExpense),
    balance: round2(totalIncome - totalExpense),
    savingsRate: totalIncome > 0 ? round2(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
    expenseByCategory: mapToArray(expenseMap, totalExpense),
    incomeByCategory: mapToArray(incomeMap, totalIncome),
    transactionCount: transactions.length,
    confirmedCount,
    suggestedCount
  };
}

// ─── Main Handler ──────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { operation, data } = await req.json();
    let result: any;

    switch (operation) {
      case "calculate-health-score":
        result = calculateHealthScore(data);
        break;
      case "calculate-budget-deviation":
        result = calculateBudgetDeviation(data.budgets, data.transactions);
        break;
      case "calculate-forecast":
        result = calculateCashflowForecast(data);
        break;
      case "calculate-goal-progress":
        result = calculateGoalProgress(data.goals, data.contributions);
        break;
      case "calculate-loan-indicators":
        result = calculateLoanIndicators(data.loans, data.installments);
        break;
      case "calculate-monthly-summary":
        result = calculateMonthlySummary(data.transactions);
        break;
      case "calculate-mei-summary":
        result = calculateMeiSummary(data.transactions, data.annualLimit);
        break;
      default:
        throw new Error(`Operação inválida: ${operation}`);
    }

    const response = {
      result,
      base_data_summary: {
        operation,
        timestamp: new Date().toISOString(),
        version: "1.0.0-sprint1",
        status: "deterministic_calculated"
      },
      metadata: {
        source: "system_generated",
        confidence: "alta",
        status: "confirmed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("finance-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
