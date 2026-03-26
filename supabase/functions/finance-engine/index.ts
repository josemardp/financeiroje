import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  papel_negocio?:
    | "receita_operacional"
    | "custo_direto"
    | "despesa_operacional"
    | "tributo"
    | "retirada"
    | "investimento"
    | "financeiro"
    | null;
  e_dedutivel?: boolean | null;
  categoria_fiscal?: string | null;
  ano_fiscal?: number | null;
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
  scope: "private" | "family" | "business" | null;
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
  tipo?: string | null;
  credor?: string | null;
  data_inicio?: string | null;
  ativo?: boolean | null;
  scope?: "private" | "family" | "business" | null;
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

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function normalizeDescription(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFrequencyDays(freq: string | null | undefined): number {
  switch (freq) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "biweekly":
      return 15;
    case "quarterly":
      return 91;
    case "semiannual":
      return 182;
    case "yearly":
      return 365;
    case "monthly":
    default:
      return 30;
  }
}

function monthlyEquivalent(value: number, freq: string | null | undefined): number {
  switch (freq) {
    case "daily":
      return value * 30;
    case "weekly":
      return value * 4.345;
    case "biweekly":
      return value * 2;
    case "quarterly":
      return value / 3;
    case "semiannual":
      return value / 6;
    case "yearly":
      return value / 12;
    case "monthly":
    default:
      return value;
  }
}

function annualEquivalent(value: number, freq: string | null | undefined): number {
  switch (freq) {
    case "daily":
      return value * 365;
    case "weekly":
      return value * 52;
    case "biweekly":
      return value * 26;
    case "quarterly":
      return value * 4;
    case "semiannual":
      return value * 2;
    case "yearly":
      return value;
    case "monthly":
    default:
      return value * 12;
  }
}

function clampDay(day: number | null | undefined): number {
  const normalized = Number(day || 1);
  if (!Number.isFinite(normalized)) return 1;
  return Math.max(1, Math.min(28, Math.round(normalized)));
}

function inferNextChargeDate(
  freq: string | null | undefined,
  billingDay: number | null | undefined,
  lastChargeDate?: string | null,
): string | null {
  const today = new Date();
  const safeDay = clampDay(billingDay);

  if (lastChargeDate) {
    const base = new Date(lastChargeDate);
    const next = addDays(base, getFrequencyDays(freq));
    if (!Number.isNaN(next.getTime())) return formatDateISO(next);
  }

  if (freq === "yearly") {
    const next = new Date(today.getFullYear(), today.getMonth(), safeDay);
    if (next < today) next.setFullYear(next.getFullYear() + 1);
    return formatDateISO(next);
  }

  if (freq === "quarterly" || freq === "semiannual" || freq === "monthly") {
    const next = new Date(today.getFullYear(), today.getMonth(), safeDay);
    if (next < today) {
      const months = freq === "quarterly" ? 3 : freq === "semiannual" ? 6 : 1;
      return formatDateISO(addMonths(next, months));
    }
    return formatDateISO(next);
  }

  return formatDateISO(addDays(today, getFrequencyDays(freq)));
}

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

  const comprometimentoRenda =
    input.totalIncome > 0 ? calcComprometimento(input.totalIncome, input.totalExpense) : null;
  const reservaEmergencia = input.emergencyReserveConfigured
    ? calcReserva(input.emergencyReserve, input.totalExpense)
    : null;
  const controleOrcamento = input.budgetConfigured
    ? calcControleOrcamento(input.budgetDeviation)
    : null;
  const adimplencia =
    input.totalInstallments > 0
      ? calcAdimplencia(input.overdueInstallments, input.totalInstallments)
      : null;
  const regularidade =
    input.totalMonthsPossible > 1
      ? calcRegularidade(input.monthsWithData, input.totalMonthsPossible)
      : null;

  const components = [
    { value: comprometimentoRenda, weight: 0.25 },
    { value: reservaEmergencia, weight: 0.25 },
    { value: controleOrcamento, weight: 0.2 },
    { value: adimplencia, weight: 0.2 },
    { value: regularidade, weight: 0.1 },
  ];

  const available = components.filter((c) => c.value !== null);
  let scoreGeral = null;

  if (available.length > 0) {
    const totalWeight = available.reduce((s, c) => s + c.weight, 0);
    const weightedSum = available.reduce((s, c) => s + c.value! * c.weight, 0);
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

function calculateBudgetDeviation(budgets: BudgetRaw[], transactions: TransactionRaw[]) {
  const expenseTransactions = transactions.filter((t) => t.tipo === "expense");
  const items = budgets.map((budget) => {
    const categoryTxns = expenseTransactions.filter((t) => t.categoria_id === budget.categoria_id);
    const actual = categoryTxns
      .filter((t) => t.data_status === "confirmed" || !t.data_status)
      .reduce((s, t) => s + Number(t.valor), 0);
    const suggestedActual = categoryTxns
      .filter((t) => t.data_status === "suggested")
      .reduce((s, t) => s + Number(t.valor), 0);
    const deviationAbsolute = actual - Number(budget.valor_planejado);
    const deviationPercent =
      budget.valor_planejado > 0 ? (deviationAbsolute / budget.valor_planejado) * 100 : 0;

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
      status,
    };
  });

  const totalPlanned = budgets.reduce((s, b) => s + Number(b.valor_planejado), 0);
  const totalActual = items.reduce((s, i) => s + i.actual, 0);
  const totalDeviationAbsolute = totalActual - totalPlanned;
  const totalDeviationPercent =
    totalPlanned > 0 ? (totalDeviationAbsolute / totalPlanned) * 100 : 0;

  let overallStatus: "ok" | "warning" | "exceeded" = "ok";
  if (totalDeviationPercent > 5) overallStatus = "exceeded";
  else if (totalDeviationPercent > 0) overallStatus = "warning";

  return {
    items,
    totalPlanned: round2(totalPlanned),
    totalActual: round2(totalActual),
    totalDeviationAbsolute: round2(totalDeviationAbsolute),
    totalDeviationPercent: round2(totalDeviationPercent),
    overallStatus,
  };
}

function calculateCashflowForecast(input: any) {
  const { currentBalance, recurringTransactions, upcomingInstallments } = input;

  const horizons = [
    { days: 7, label: "7 dias" },
    { days: 30, label: "30 dias" },
    { days: 90, label: "90 dias" },
  ].map((h) => {
    let totalInflows = 0;
    let totalOutflows = 0;

    recurringTransactions
      .filter((r: any) => r.ativa)
      .forEach((r: any) => {
        const occurrences = h.days / 30;
        if (r.tipo === "income") totalInflows += r.valor * occurrences;
        else totalOutflows += r.valor * occurrences;
      });

    upcomingInstallments
      .filter((i: any) => {
        const dueDate = new Date(i.data_vencimento);
        const diff = (dueDate.getTime() - Date.now()) / (1000 * 3600 * 24);
        return diff >= 0 && diff <= h.days && !i.data_pagamento;
      })
      .forEach((i: any) => {
        totalOutflows += Number(i.valor);
      });

    return {
      days: h.days,
      label: h.label,
      projectedBalance: round2(currentBalance + totalInflows - totalOutflows),
      totalInflows: round2(totalInflows),
      totalOutflows: round2(totalOutflows),
      confidenceLevel: h.days <= 30 ? "alta" : "media",
    };
  });

  return {
    currentMonthlyBalance: round2(currentBalance),
    horizons,
    assumptions: ["Baseado em transações recorrentes e parcelas registradas no banco de dados."],
    warnings:
      horizons[0].projectedBalance < 0 ? ["Risco de saldo negativo nos próximos 7 dias!"] : [],
  };
}

function calculateGoalProgress(goals: GoalRaw[], contributions: GoalContributionRaw[]) {
  return goals.map((goal) => {
    const goalContributions = contributions.filter((c) => c.goal_id === goal.id);
    const totalContributed = goalContributions.reduce((s, c) => s + Number(c.valor), 0);
    const currentVal = (Number(goal.valor_atual) || 0) + totalContributed;
    const progressPercent = goal.valor_alvo > 0 ? (currentVal / goal.valor_alvo) * 100 : 0;
    const remainingAmount = Math.max(0, goal.valor_alvo - currentVal);

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
      projectedCompletionDate: null,
      monthlyContributionNeeded,
      isOnTrack: progressPercent > 0,
      totalContributed: round2(totalContributed),
    };
  });
}

function calculateLoanIndicators(loans: LoanRaw[], installments: InstallmentRaw[]) {
  const results = loans.map((loan) => {
    const loanInstallments = installments.filter((i) => i.emprestimo_id === loan.id);
    const paidInstallments = loanInstallments.filter((i) => i.status === "pago" || i.data_pagamento);
    const pendingInstallments = loanInstallments.filter(
      (i) => i.status !== "pago" && !i.data_pagamento,
    );

    const totalJaPago = paidInstallments.reduce((s, i) => s + Number(i.valor), 0);
    const saldoAtual =
      loan.saldo_devedor !== null && loan.saldo_devedor !== undefined
        ? Number(loan.saldo_devedor)
        : Math.max(0, Number(loan.valor_original) - totalJaPago);
    const parcelasRestantes = Number(loan.parcelas_restantes) || pendingInstallments.length;
    const valorParcela =
      Number(loan.valor_parcela) ||
      (pendingInstallments[0] ? Number(pendingInstallments[0].valor) : 0);
    const custoEstimadoRestante = round2(parcelasRestantes * valorParcela);

    const taxaMensal = Number(loan.taxa_juros_mensal) || 0;
    const impactoAmortizacaoExtra =
      taxaMensal > 0 && parcelasRestantes > 0
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

function calculateMeiSummary(transactions: TransactionRaw[], annualLimit: number = 81000) {
  const businessTxns = transactions.filter((t) => t.scope === "business");

  let receitaBruta = 0;
  let custosOperacionais = 0;
  let despesasIndiretas = 0;
  let tributos = 0;
  let retiradas = 0;

  businessTxns.forEach((t) => {
    const valor = Number(t.valor) || 0;

    if (t.papel_negocio) {
      switch (t.papel_negocio) {
        case "receita_operacional":
          receitaBruta += valor;
          break;
        case "custo_direto":
          custosOperacionais += valor;
          break;
        case "despesa_operacional":
          despesasIndiretas += valor;
          break;
        case "tributo":
          tributos += valor;
          break;
        case "retirada":
          retiradas += valor;
          break;
        default:
          if (t.tipo === "income") receitaBruta += valor;
          else despesasIndiretas += valor;
      }
    } else if (t.tipo === "income") {
      receitaBruta += valor;
    } else if (t.categoria_is_business_cost || t.e_mei) {
      custosOperacionais += valor;
    } else {
      despesasIndiretas += valor;
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
    tributos: round2(tributos),
    retiradas: round2(retiradas),
    lucroOperacional: round2(lucroOperacional),
    margemLucro: receitaBruta > 0 ? round2((lucroOperacional / receitaBruta) * 100) : 0,
    percentualLimite: round2(percentualLimite),
    limiteAnual: annualLimit,
    valorRestanteLimite: round2(Math.max(0, annualLimit - receitaBruta)),
    alertLevel,
    businessTransactionCount: businessTxns.length,
  };
}

function calculateFiscalSummary(transactions: TransactionRaw[], year: number) {
  const yearTxns = transactions.filter((t) => {
    const txnYear = t.ano_fiscal || new Date(t.data).getFullYear();
    return txnYear === year;
  });

  const income = yearTxns.filter((t) => t.tipo === "income");
  const expense = yearTxns.filter((t) => t.tipo === "expense");

  const deductions: Record<string, number> = {
    saude: 0,
    educacao: 0,
    previdencia: 0,
    dependentes: 0,
    outros: 0,
  };

  expense
    .filter((t) => t.e_dedutivel)
    .forEach((t) => {
      const cat = (t.categoria_fiscal || "").toLowerCase();
      if (cat.includes("saude") || cat.includes("medic")) deductions.saude += t.valor;
      else if (cat.includes("educa")) deductions.educacao += t.valor;
      else if (cat.includes("previ")) deductions.previdencia += t.valor;
      else deductions.outros += t.valor;
    });

  const totalIncome = income.reduce((s, t) => s + t.valor, 0);
  const totalDeductions = Object.values(deductions).reduce((s, v) => s + v, 0);
  const standardDiscount = Math.min(totalIncome * 0.2, 16754.34);
  const baseSimplificada = Math.max(0, totalIncome - standardDiscount);
  const baseCompleta = Math.max(0, totalIncome - totalDeductions);

  return {
    year,
    totalIncome: round2(totalIncome),
    totalDeductions: round2(totalDeductions),
    deductionsByCategory: deductions,
    standardDiscount: round2(standardDiscount),
    baseSimplificada: round2(baseSimplificada),
    baseCompleta: round2(baseCompleta),
    melhorOpcao: baseSimplificada <= baseCompleta ? "simplificada" : "completa",
    taxableIncomeCount: income.length,
    deductibleExpenseCount: expense.filter((t) => t.e_dedutivel).length,
  };
}

function calculateSubscriptionSummary(input: {
  subscriptions: any[];
  recurrings: any[];
  transactions: any[];
}) {
  const subscriptions = input.subscriptions || [];
  const recurrings = input.recurrings || [];
  const transactions = input.transactions || [];
  const itemMap = new Map<string, any>();

  const upsert = (item: any, priority: number) => {
    const key = normalizeDescription(item.name) || item.id;
    const existing = itemMap.get(key);
    if (!existing || priority < existing.priority) {
      itemMap.set(key, { ...item, priority });
    }
  };

  subscriptions
    .filter((sub) => (sub.status || "active") !== "cancelled")
    .forEach((sub) => {
      const freq = sub.frequency || "monthly";
      const currentValue = Number(sub.valor_mensal || sub.current_value || 0);
      const monthly = round2(
        sub.annual_amount ? Number(sub.annual_amount) / 12 : monthlyEquivalent(currentValue, freq),
      );
      const annual = round2(
        sub.annual_amount ? Number(sub.annual_amount) : annualEquivalent(currentValue, freq),
      );
      const nextChargeDate =
        sub.next_charge_date ||
        inferNextChargeDate(freq, sub.billing_day ?? sub.data_cobranca, sub.last_charge_date);
      const renewalDate = sub.renewal_date || (freq === "yearly" ? nextChargeDate : null);
      const alertFlags: string[] = [];

      if (
        sub.last_amount &&
        currentValue > 0 &&
        Number(sub.last_amount) > 0 &&
        currentValue > Number(sub.last_amount) * 1.08
      ) {
        alertFlags.push("reajuste");
      }

      const referenceDate = renewalDate || nextChargeDate;
      if (referenceDate && daysBetween(new Date(), new Date(referenceDate)) <= 30) {
        alertFlags.push(freq === "yearly" ? "renovacao" : "vencimento_proximo");
      }

      upsert(
        {
          id: `manual-${sub.id}`,
          sourceId: sub.id,
          name: sub.nome_servico,
          scope: sub.scope || null,
          status: sub.status || "active",
          origin: sub.origin || "manual",
          detectionMethod: sub.detection_method || "cadastro_manual",
          currentValue: round2(currentValue),
          frequency: freq,
          monthlyEquivalent: monthly,
          annualEquivalent: annual,
          billingDay: sub.billing_day ?? sub.data_cobranca ?? null,
          nextChargeDate,
          renewalDate,
          lastChargeDate: sub.last_charge_date || null,
          alertFlags,
        },
        1,
      );
    });

  recurrings
    .filter((rec) => rec.ativa !== false && rec.tipo === "expense")
    .forEach((rec) => {
      const freq = rec.frequencia || "monthly";
      const currentValue = Number(rec.valor || 0);
      const nextChargeDate = inferNextChargeDate(freq, rec.dia_mes, null);
      const alertFlags: string[] = [];
      if (nextChargeDate && daysBetween(new Date(), new Date(nextChargeDate)) <= 7) {
        alertFlags.push("vencimento_proximo");
      }
      upsert(
        {
          id: `recurring-${rec.id}`,
          sourceId: rec.id,
          name: rec.descricao,
          scope: rec.scope || null,
          status: rec.ativa === false ? "paused" : "active",
          origin: "detected",
          detectionMethod: "recorrencia_ativa",
          currentValue: round2(currentValue),
          frequency: freq,
          monthlyEquivalent: round2(monthlyEquivalent(currentValue, freq)),
          annualEquivalent: round2(annualEquivalent(currentValue, freq)),
          billingDay: rec.dia_mes || null,
          nextChargeDate,
          renewalDate: freq === "yearly" ? nextChargeDate : null,
          lastChargeDate: null,
          alertFlags,
        },
        2,
      );
    });

  const txGroups = new Map<string, TransactionRaw[]>();
  transactions
    .filter((tx) => tx.tipo === "expense" && (tx.data_status === "confirmed" || !tx.data_status))
    .forEach((tx) => {
      const key = normalizeDescription(tx.descricao);
      if (!key || key.length < 3) return;
      const arr = txGroups.get(key) || [];
      arr.push(tx);
      txGroups.set(key, arr);
    });

  txGroups.forEach((group, key) => {
    if (group.length < 2 || itemMap.has(key)) return;

    const sorted = [...group].sort((a, b) => a.data.localeCompare(b.data));
    const amounts = sorted.map((t) => Number(t.valor || 0)).filter((n) => n > 0);
    if (amounts.length < 2) return;

    const diffs: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      diffs.push(daysBetween(new Date(sorted[i - 1].data), new Date(sorted[i].data)));
    }
    const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    let freq: string | null = null;
    if (avgDiff >= 20 && avgDiff <= 40) freq = "monthly";
    else if (avgDiff >= 75 && avgDiff <= 100) freq = "quarterly";
    else if (avgDiff >= 160 && avgDiff <= 210) freq = "semiannual";
    else if (avgDiff >= 330 && avgDiff <= 390) freq = "yearly";
    else if (avgDiff >= 6 && avgDiff <= 9) freq = "weekly";
    if (!freq) return;

    const latest = sorted[sorted.length - 1];
    const previousAmounts = amounts.slice(0, -1);
    const previousMedian =
      previousAmounts.length > 0
        ? previousAmounts.sort((a, b) => a - b)[Math.floor(previousAmounts.length / 2)]
        : amounts[0];
    const latestValue = Number(latest.valor || 0);
    const nextChargeDate = formatDateISO(addDays(new Date(latest.data), getFrequencyDays(freq)));
    const recentWindow = sorted.filter(
      (tx) => daysBetween(new Date(tx.data), new Date(latest.data)) <= 15,
    );
    const alertFlags: string[] = [];

    if (previousMedian > 0 && latestValue > previousMedian * 1.08) {
      alertFlags.push("reajuste");
    }
    if (recentWindow.length >= 2) {
      alertFlags.push("cobranca_suspeita");
    }
    if (freq === "yearly" && daysBetween(new Date(), new Date(nextChargeDate)) <= 45) {
      alertFlags.push("renovacao");
    }

    upsert(
      {
        id: `pattern-${latest.id}`,
        sourceId: latest.id,
        name: latest.descricao || "Assinatura detectada",
        scope: latest.scope || null,
        status: "active",
        origin: "detected",
        detectionMethod: "padrao_transacional_confirmado",
        currentValue: round2(latestValue),
        frequency: freq,
        monthlyEquivalent: round2(monthlyEquivalent(latestValue, freq)),
        annualEquivalent: round2(annualEquivalent(latestValue, freq)),
        billingDay: new Date(latest.data).getDate(),
        nextChargeDate,
        renewalDate: freq === "yearly" ? nextChargeDate : null,
        lastChargeDate: latest.data,
        alertFlags,
      },
      3,
    );
  });

  const items = Array.from(itemMap.values())
    .map(({ priority, ...rest }) => rest)
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalsMonthly = round2(items.reduce((sum, item) => sum + Number(item.monthlyEquivalent || 0), 0));
  const totalsAnnual = round2(items.reduce((sum, item) => sum + Number(item.annualEquivalent || 0), 0));

  const alerts = items.flatMap((item) =>
    (item.alertFlags || []).map((flag: string) => {
      const titles: Record<string, string> = {
        reajuste: `Reajuste detectado em ${item.name}`,
        renovacao: `Renovação próxima: ${item.name}`,
        cobranca_suspeita: `Cobrança suspeita: ${item.name}`,
        vencimento_proximo: `Cobrança próxima: ${item.name}`,
      };
      const messages: Record<string, string> = {
        reajuste: `${item.name} teve variação relevante de valor e merece revisão.`,
        renovacao: `${item.name} está com renovação/cobrança relevante prevista para breve.`,
        cobranca_suspeita: `${item.name} apresentou padrão de cobrança fora do esperado.`,
        vencimento_proximo: `${item.name} vence/cobra novamente nos próximos dias.`,
      };
      return {
        tipo: flag,
        titulo: titles[flag] || `Alerta de assinatura: ${item.name}`,
        mensagem: messages[flag] || `${item.name} requer atenção.`,
        nivel:
          flag === "cobranca_suspeita"
            ? "critical"
            : flag === "reajuste"
              ? "warning"
              : flag === "renovacao"
                ? "info"
                : "warning",
        dados: {
          assinatura: item.name,
          valorAtual: item.currentValue,
          frequencia: item.frequency,
          origem: item.detectionMethod,
          nextChargeDate: item.nextChargeDate,
        },
      };
    }),
  );

  return {
    items,
    totalsMonthly,
    totalsAnnual,
    alertCount: alerts.length,
    alerts,
    detectionRules: [
      "manual: cadastro em subscriptions",
      "recurring: despesa ativa em recurring_transactions",
      "transaction_pattern: despesas confirmadas repetidas com periodicidade e valor coerentes",
    ],
  };
}

function deriveLoanState(loan: LoanRaw, installments: InstallmentRaw[]) {
  const related = installments.filter((i) => i.emprestimo_id === loan.id);
  const paid = related.filter((i) => i.status === "pago" || i.data_pagamento);
  const totalPaid = paid.reduce((sum, item) => sum + Number(item.valor), 0);
  const balance =
    loan.saldo_devedor !== null && loan.saldo_devedor !== undefined
      ? Number(loan.saldo_devedor)
      : Math.max(0, Number(loan.valor_original || 0) - totalPaid);
  const monthlyRate = Math.max(0, Number(loan.taxa_juros_mensal || 0) / 100);
  const remaining = Math.max(
    1,
    Number(loan.parcelas_restantes || 0) || related.filter((i) => i.status !== "pago").length || 24,
  );

  let basePayment = Number(loan.valor_parcela || 0);
  if (!(basePayment > 0)) {
    if (monthlyRate > 0) {
      const numerator = balance * monthlyRate;
      const denominator = 1 - Math.pow(1 + monthlyRate, -remaining);
      basePayment = denominator > 0 ? numerator / denominator : balance / remaining;
    } else {
      basePayment = balance / remaining;
    }
  }
  basePayment = Math.max(1, round2(basePayment));

  return {
    id: loan.id,
    name: loan.nome,
    balance: round2(balance),
    monthlyRate,
    minimumPayment: basePayment,
    remaining,
  };
}

function simulateDebtScenario(
  loans: Array<{ id: string; name: string; balance: number; monthlyRate: number; minimumPayment: number }>,
  extraPayment: number,
  strategy: "current" | "extra" | "avalanche" | "snowball",
) {
  const states = loans.map((loan) => ({ ...loan }));
  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  const payoffOrder: string[] = [];

  while (states.some((state) => state.balance > 0.01) && months < 600) {
    months += 1;

    for (const state of states) {
      if (state.balance <= 0.01) continue;
      const interest = round2(state.balance * state.monthlyRate);
      state.balance = round2(state.balance + interest);
      totalInterest += interest;
    }

    for (const state of states) {
      if (state.balance <= 0.01) continue;
      const payment = Math.min(state.balance, state.minimumPayment);
      state.balance = round2(state.balance - payment);
      totalPaid += payment;
      if (state.balance <= 0.01 && !payoffOrder.includes(state.name)) {
        payoffOrder.push(state.name);
      }
    }

    let remainingExtra = Math.max(0, extraPayment);

    if (remainingExtra > 0 && strategy === "extra") {
      const active = states.filter((state) => state.balance > 0.01);
      const totalBalance = active.reduce((sum, state) => sum + state.balance, 0);
      for (const state of active) {
        if (remainingExtra <= 0) break;
        const share = totalBalance > 0 ? (state.balance / totalBalance) * extraPayment : 0;
        const payment = Math.min(state.balance, round2(share));
        state.balance = round2(state.balance - payment);
        totalPaid += payment;
        remainingExtra -= payment;
        if (state.balance <= 0.01 && !payoffOrder.includes(state.name)) {
          payoffOrder.push(state.name);
        }
      }
    }

    while (remainingExtra > 0.01 && strategy !== "current") {
      const active = states.filter((state) => state.balance > 0.01);
      if (active.length === 0) break;
      active.sort((a, b) => {
        if (strategy === "snowball") return a.balance - b.balance;
        return b.monthlyRate - a.monthlyRate || a.balance - b.balance;
      });
      const target = active[0];
      const payment = Math.min(target.balance, remainingExtra);
      target.balance = round2(target.balance - payment);
      totalPaid += payment;
      remainingExtra = round2(remainingExtra - payment);
      if (target.balance <= 0.01 && !payoffOrder.includes(target.name)) {
        payoffOrder.push(target.name);
      }
      if (strategy === "extra") break;
    }
  }

  const payoffDate = formatDateISO(addMonths(new Date(), months));

  return {
    payoffMonths: months,
    totalPaid: round2(totalPaid),
    totalInterest: round2(totalInterest),
    payoffDate,
    payoffOrder,
  };
}

function calculateDebtStrategies(input: {
  loans: LoanRaw[];
  installments: InstallmentRaw[];
  extraPayment: number;
}) {
  const loans = (input.loans || [])
    .filter((loan) => loan.ativo !== false)
    .map((loan) => deriveLoanState(loan, input.installments || []))
    .filter((loan) => loan.balance > 0.01);

  if (loans.length === 0) {
    return {
      scenarios: [],
      recommendedKey: null,
      totalBalance: 0,
      loanCount: 0,
    };
  }

  const extraPayment = Math.max(0, Number(input.extraPayment || 0));

  const current = simulateDebtScenario(loans, 0, "current");
  const extra = simulateDebtScenario(loans, extraPayment, "extra");
  const avalanche = simulateDebtScenario(loans, extraPayment, "avalanche");
  const snowball = simulateDebtScenario(loans, extraPayment, "snowball");

  const scenarios = [
    {
      key: "current",
      name: "Cenário atual",
      extraPaymentApplied: 0,
      ...current,
    },
    {
      key: "extra",
      name: "Pagamento extra",
      extraPaymentApplied: extraPayment,
      ...extra,
    },
    {
      key: "avalanche",
      name: "Avalanche",
      extraPaymentApplied: extraPayment,
      ...avalanche,
    },
    {
      key: "snowball",
      name: "Bola de neve",
      extraPaymentApplied: extraPayment,
      ...snowball,
    },
  ];

  const recommended = [...scenarios].sort((a, b) => {
    if (a.totalInterest !== b.totalInterest) return a.totalInterest - b.totalInterest;
    return a.payoffMonths - b.payoffMonths;
  })[0];

  return {
    scenarios,
    recommendedKey: recommended?.key || null,
    totalBalance: round2(loans.reduce((sum, loan) => sum + loan.balance, 0)),
    loanCount: loans.length,
  };
}

function calculateFinancialCalendar(input: {
  month: number;
  year: number;
  recurrings: any[];
  installments: any[];
  subscriptions: any[];
}) {
  const month = Number(input.month);
  const year = Number(input.year);
  const items: any[] = [];

  (input.installments || []).forEach((inst: any) => {
    if (!inst.data_vencimento || inst.status === "pago") return;
    const due = new Date(inst.data_vencimento);
    if (due.getFullYear() !== year || due.getMonth() + 1 !== month) return;
    items.push({
      id: `installment-${inst.id}`,
      date: inst.data_vencimento,
      title: inst.emprestimo_nome ? `Parcela — ${inst.emprestimo_nome}` : "Parcela",
      amount: round2(Number(inst.valor || 0)),
      type: "installment",
      kind: "expense",
      scope: inst.scope || null,
      level: daysBetween(new Date(), due) <= 3 ? "critical" : "warning",
      description: inst.emprestimo_nome || "Parcela de dívida",
    });
  });

  (input.subscriptions || [])
    .filter((sub: any) => (sub.status || "active") !== "cancelled")
    .forEach((sub: any) => {
      const freq = sub.frequency || "monthly";
      const nextDate =
        sub.next_charge_date ||
        inferNextChargeDate(freq, sub.billing_day ?? sub.data_cobranca, sub.last_charge_date);
      const chargeDate = nextDate ? new Date(nextDate) : null;
      if (chargeDate && chargeDate.getFullYear() === year && chargeDate.getMonth() + 1 === month) {
        items.push({
          id: `subscription-${sub.id}`,
          date: formatDateISO(chargeDate),
          title: `Assinatura — ${sub.nome_servico}`,
          amount: round2(Number(sub.valor_mensal || 0)),
          type: "subscription",
          kind: "expense",
          scope: sub.scope || null,
          level: daysBetween(new Date(), chargeDate) <= 3 ? "warning" : "info",
          description: "Cobrança de assinatura",
        });
      }

      if (sub.renewal_date) {
        const renewal = new Date(sub.renewal_date);
        if (renewal.getFullYear() === year && renewal.getMonth() + 1 === month) {
          items.push({
            id: `renewal-${sub.id}`,
            date: formatDateISO(renewal),
            title: `Renovação — ${sub.nome_servico}`,
            amount: round2(Number(sub.annual_amount || sub.valor_mensal || 0)),
            type: "renewal",
            kind: "expense",
            scope: sub.scope || null,
            level: daysBetween(new Date(), renewal) <= 7 ? "warning" : "info",
            description: "Renovação relevante de assinatura",
          });
        }
      }
    });

  (input.recurrings || [])
    .filter((rec: any) => rec.ativa !== false && rec.frequencia === "monthly" && rec.dia_mes)
    .forEach((rec: any) => {
      const date = new Date(year, month - 1, clampDay(rec.dia_mes));
      items.push({
        id: `recurring-${rec.id}`,
        date: formatDateISO(date),
        title:
          rec.scope === "business"
            ? `Compromisso do negócio — ${rec.descricao}`
            : `Recorrência — ${rec.descricao}`,
        amount: round2(Number(rec.valor || 0)),
        type: rec.scope === "business" ? "business_commitment" : "recurring",
        kind: rec.tipo === "income" ? "income" : "expense",
        scope: rec.scope || null,
        level: daysBetween(new Date(), date) <= 3 ? "warning" : "info",
        description: rec.tipo === "income" ? "Receita recorrente" : "Despesa recorrente",
      });
    });

  items.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  const totalInflow = round2(
    items.filter((item) => item.kind === "income").reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );
  const totalOutflow = round2(
    items.filter((item) => item.kind !== "income").reduce((sum, item) => sum + Number(item.amount || 0), 0),
  );
  const dueSoonCount = items.filter((item) => {
    const diff = daysBetween(new Date(), new Date(item.date));
    return diff >= 0 && diff <= 7;
  }).length;

  return {
    month,
    year,
    items,
    totalInflow,
    totalOutflow,
    dueSoonCount,
  };
}

function calculateMonthlySummary(transactions: TransactionRaw[]) {
  let totalIncome = 0;
  let totalExpense = 0;
  let confirmedCount = 0;
  let suggestedCount = 0;

  const expenseMap = new Map();
  const incomeMap = new Map();

  transactions.forEach((t) => {
    const valor = Number(t.valor) || 0;
    if (t.data_status === "confirmed" || !t.data_status) confirmedCount += 1;
    if (t.data_status === "suggested") suggestedCount += 1;

    if (t.tipo === "income") {
      totalIncome += valor;
      const key = t.categoria_id || "sem_categoria";
      const existing = incomeMap.get(key) || {
        name: t.categoria_nome || "Sem categoria",
        icon: t.categoria_icone || "📋",
        total: 0,
        count: 0,
      };
      existing.total += valor;
      existing.count += 1;
      incomeMap.set(key, existing);
    } else {
      totalExpense += valor;
      const key = t.categoria_id || "sem_categoria";
      const existing = expenseMap.get(key) || {
        name: t.categoria_nome || "Sem categoria",
        icon: t.categoria_icone || "📋",
        total: 0,
        count: 0,
      };
      existing.total += valor;
      existing.count += 1;
      expenseMap.set(key, existing);
    }
  });

  const mapToArray = (map: Map<string, any>, total: number) =>
    Array.from(map.entries())
      .map(([id, data]) => ({
        categoryId: id === "sem_categoria" ? null : id,
        categoryName: data.name,
        categoryIcon: data.icon,
        total: round2(data.total),
        count: data.count,
        percentage: total > 0 ? round2((data.total / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

  return {
    totalIncome: round2(totalIncome),
    totalExpense: round2(totalExpense),
    balance: round2(totalIncome - totalExpense),
    savingsRate: totalIncome > 0 ? round2(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
    expenseByCategory: mapToArray(expenseMap, totalExpense),
    incomeByCategory: mapToArray(incomeMap, totalIncome),
    transactionCount: transactions.length,
    confirmedCount,
    suggestedCount,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      case "calculate-fiscal-summary":
        result = calculateFiscalSummary(data.transactions, data.year);
        break;
      case "calculate-subscription-summary":
        result = calculateSubscriptionSummary(data);
        break;
      case "calculate-debt-strategies":
        result = calculateDebtStrategies(data);
        break;
      case "calculate-financial-calendar":
        result = calculateFinancialCalendar(data);
        break;
      default:
        throw new Error(`Operação inválida: ${operation}`);
    }

    const response = {
      result,
      base_data_summary: {
        operation,
        timestamp: new Date().toISOString(),
        version: "1.0.0-sprint7",
        status: "deterministic_calculated",
      },
      metadata: {
        source: "system_generated",
        confidence: "alta",
        status: "confirmed",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("finance-engine error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
