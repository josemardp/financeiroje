/**
 * FinanceAI — Fase 3 — Coleta de Contexto para IA Conselheira
 * 
 * Responsabilidade: coletar dados financeiros reais do usuário
 * e montar um payload estruturado para envio à IA.
 * 
 * REGRA: A IA nunca faz cálculo. Ela recebe outputs da engine.
 * REGRA: Dados separados por status (confirmado vs sugerido vs projeção).
 * REGRA: Reserva usa DESPESA mensal para cobertura, não renda.
 * REGRA: Saldo das contas = saldo_inicial + transações confirmadas.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  calculateMonthlySummary,
  calculateBudgetDeviation,
  calculateHealthScore,
  calculateCashflowForecast,
  calculateGoalProgress,
  calculateLoanIndicators,
  filterOfficialTransactions,
  filterPendingTransactions,
} from "@/services/financeEngine";
import type {
  TransactionRaw,
  BudgetRaw,
  RecurringRaw,
  LoanRaw,
  InstallmentRaw,
  ExtraAmortizationRaw,
  GoalRaw,
  GoalContributionRaw,
  MonthlySummary,
  BudgetDeviationResult,
  HealthScoreResult,
  CashflowForecastResult,
  GoalProgressResult,
  LoanSummary,
} from "@/services/financeEngine/types";

export interface FinancialContext {
  periodo: { mes: number; ano: number };
  escopo: string;
  resumoMensal: MonthlySummary | null;
  resumoConfirmado: MonthlySummary | null;
  pendencias: { count: number; valorTotal: number; tipos: { suggested: number; incomplete: number; inconsistent: number } };
  orcamento: BudgetDeviationResult | null;
  dividas: LoanSummary | null;
  metas: GoalProgressResult[];
  previsaoCaixa: CashflowForecastResult | null;
  scoreFinanceiro: HealthScoreResult | null;
  recorrenciasAtivas: number;
  alertasAtivos: { total: number; critical: number; warning: number; info: number };
  valoresFamiliares: string[];
  qualidadeDados: {
    semCategoria: number;
    sugeridosPendentes: number;
    incompletosPendentes: number;
    inconsistentes: number;
    impactoNaPrecisao: "baixo" | "medio" | "alto";
  };
  contas: { nome: string; tipo: string; saldo_inicial: number; saldo_atual: number }[];
  reservaEmergencia: {
    valor: number;
    metaMeses: number;
    despesaMensalRef: number;
    coberturaMeses: number | null;
    statusMeta: "abaixo" | "ok" | "acima";
  } | null;
  padroesPorCategoria: Array<{
    categoria: string;
    totalGasto: number;
    percentualDasDespesas: number;
    statusOrcamento: "dentro" | "acima";
    desvio?: number;
  }>;
  impactoEmMetas: Array<{
    metaNome: string;
    velocidadeAtual: number;
    diasParaConcluir?: number;
    emRisco: boolean;
  }>;
  preferenciasUsuario: Record<string, unknown>;
  metadados: {
    dataColeta: string;
    versaoEngine: string;
    nota: string;
    avisoAlucinacao: string;
  };
}

export async function getFinancialContext(
  userId: string,
  scope: string = "all",
  month?: number,
  year?: number
): Promise<FinancialContext> {
  const now = new Date();
  const mes = month || now.getMonth() + 1;
  const ano = year || now.getFullYear();
  const startOfMonth = new Date(ano, mes - 1, 1).toISOString().split("T")[0];
  const endOfMonth = new Date(ano, mes, 0).toISOString().split("T")[0];

  // Fetch all data in parallel
  const [
    txResult, budgetResult, recurringResult, loanResult,
    installmentResult, amortResult, goalResult, contribResult,
    alertResult, valuesResult, accountsResult, profileResult,
    accountTxResult,
  ] = await Promise.all([
    (() => {
      let q = supabase.from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)")
        .gte("data", startOfMonth).lte("data", endOfMonth);
      if (scope !== "all") q = q.eq("scope", scope);
      return q;
    })(),
    (() => {
      let q = supabase.from("budgets")
        .select("id, categoria_id, valor_planejado, mes, ano, scope, categories(nome, icone)")
        .eq("mes", mes).eq("ano", ano);
      if (scope !== "all") q = q.eq("scope", scope);
      return q;
    })(),
    (() => {
      let q = supabase.from("recurring_transactions")
        .select("id, descricao, valor, tipo, frequencia, dia_mes, ativa, categoria_id, scope")
        .eq("ativa", true);
      if (scope !== "all") q = q.eq("scope", scope);
      return q;
    })(),
    supabase.from("loans").select("*").eq("ativo", true),
    supabase.from("loan_installments").select("*").gte("data_vencimento", startOfMonth),
    supabase.from("extra_amortizations").select("*"),
    supabase.from("goals").select("*").eq("ativo", true),
    supabase.from("goal_contributions").select("*"),
    supabase.from("alerts").select("id").eq("lido", false),
    supabase.from("family_values").select("descricao"),
    supabase.from("accounts").select("*").eq("ativa", true),
    supabase.from("profiles").select("preferences").eq("user_id", userId).single(),
    // PHASE 4.2: Align with engine — confirmed + null = official
    supabase.from("transactions")
      .select("account_id, tipo, valor, data_status")
      .not("account_id", "is", null)
      .or("data_status.eq.confirmed,data_status.is.null"),
  ]);

  // Map raw data
  const rawTransactions: TransactionRaw[] = (txResult.data || []).map((t: any) => ({
    id: t.id,
    valor: Number(t.valor),
    tipo: t.tipo,
    data: t.data,
    descricao: t.descricao,
    categoria_id: t.categoria_id,
    categoria_nome: t.categories?.nome,
    categoria_icone: t.categories?.icone,
    scope: t.scope,
    data_status: t.data_status,
    source_type: t.source_type,
    confidence: t.confidence,
    e_mei: t.e_mei,
  }));

  const budgets: BudgetRaw[] = (budgetResult.data || []).map((b: any) => ({
    id: b.id,
    categoria_id: b.categoria_id,
    categoria_nome: b.categories?.nome,
    categoria_icone: b.categories?.icone,
    valor_planejado: Number(b.valor_planejado),
    mes: b.mes,
    ano: b.ano,
    scope: b.scope,
  }));

  const recurrings: RecurringRaw[] = (recurringResult.data || []).map((r: any) => ({
    id: r.id, descricao: r.descricao, valor: Number(r.valor), tipo: r.tipo,
    frequencia: r.frequencia, dia_mes: r.dia_mes, ativa: r.ativa,
    categoria_id: r.categoria_id, scope: r.scope,
  }));

  const loans: LoanRaw[] = (loanResult.data || []).map((l: any) => ({
    id: l.id, nome: l.nome, valor_original: Number(l.valor_original),
    saldo_devedor: l.saldo_devedor ? Number(l.saldo_devedor) : null,
    taxa_juros_mensal: l.taxa_juros_mensal ? Number(l.taxa_juros_mensal) : null,
    cet_anual: l.cet_anual ? Number(l.cet_anual) : null,
    parcelas_total: l.parcelas_total, parcelas_restantes: l.parcelas_restantes,
    valor_parcela: l.valor_parcela ? Number(l.valor_parcela) : null,
    metodo_amortizacao: l.metodo_amortizacao, tipo: l.tipo,
    credor: l.credor, data_inicio: l.data_inicio, ativo: l.ativo,
  }));

  const installments: InstallmentRaw[] = (installmentResult.data || []).map((i: any) => ({
    id: i.id, emprestimo_id: i.emprestimo_id, numero: i.numero,
    valor: Number(i.valor), data_vencimento: i.data_vencimento,
    data_pagamento: i.data_pagamento, status: i.status,
  }));

  const amortizations: ExtraAmortizationRaw[] = (amortResult.data || []).map((a: any) => ({
    id: a.id, emprestimo_id: a.emprestimo_id, valor: Number(a.valor),
    data: a.data, economia_juros_calculada: a.economia_juros_calculada ? Number(a.economia_juros_calculada) : null,
  }));

  const goals: GoalRaw[] = (goalResult.data || []).map((g: any) => ({
    id: g.id, nome: g.nome, valor_alvo: Number(g.valor_alvo),
    valor_atual: g.valor_atual ? Number(g.valor_atual) : null,
    prazo: g.prazo, prioridade: g.prioridade, ativo: g.ativo,
  }));

  const contributions: GoalContributionRaw[] = (contribResult.data || []).map((c: any) => ({
    id: c.id, goal_id: c.goal_id, valor: Number(c.valor), data: c.data,
  }));

  // Engine calculations — all deterministic
  const officialTxns = filterOfficialTransactions(rawTransactions);
  const pendingTxns = filterPendingTransactions(rawTransactions);
  const resumoMensal = rawTransactions.length > 0 ? calculateMonthlySummary(rawTransactions) : null;
  const resumoConfirmado = officialTxns.length > 0 ? calculateMonthlySummary(officialTxns) : null;

  const orcamento = budgets.length > 0
    ? calculateBudgetDeviation(budgets, rawTransactions, mes, ano)
    : null;

  const dividas = loans.length > 0
    ? calculateLoanIndicators(loans, installments, amortizations)
    : null;

  const metas = calculateGoalProgress(goals, contributions);

  // Forecast — uses balance from confirmed data
  const saldoAtual = resumoConfirmado ? resumoConfirmado.balance : 0;
  const previsaoCaixa = recurrings.length > 0 || installments.length > 0
    ? calculateCashflowForecast({
        currentBalance: saldoAtual,
        recurringTransactions: recurrings,
        recentTransactions: officialTxns,
        upcomingInstallments: installments.filter((i) => i.status !== "pago"),
      })
    : null;

  // Health score
  const overdueInstallments = installments.filter(
    (i) => i.status !== "pago" && new Date(i.data_vencimento) < now
  ).length;

  const hasBudget = budgets.length > 0;

  // User preferences & reserve
  const userPrefs = (profileResult.data?.preferences || {}) as Record<string, any>;
  const reserveValue = Number(userPrefs.reserva_emergencia_valor || 0);
  const reserveMonthsTarget = Number(userPrefs.reserva_emergencia_meses_meta || 6);
  const reserveConfigured = reserveValue > 0;

  // HARDENING: Reserve coverage uses EXPENSE, not income
  const despesaMensalRef = resumoConfirmado?.totalExpense || 0;

  const scoreFinanceiro = resumoConfirmado
    ? calculateHealthScore({
        totalIncome: resumoConfirmado.totalIncome,
        totalExpense: resumoConfirmado.totalExpense,
        totalDebt: dividas?.totalSaldoDevedor || 0,
        emergencyReserve: reserveValue,
        emergencyReserveConfigured: reserveConfigured,
        budgetConfigured: hasBudget,
        budgetDeviation: orcamento ? Math.max(0, orcamento.totalDeviationPercent) : 0,
        overdueInstallments,
        totalInstallments: installments.length,
        monthsWithData: 1,
        totalMonthsPossible: 1,
      })
    : null;

  // Accounts — real balance = saldo_inicial + confirmed transactions
  const accountTxnMap: Record<string, number> = {};
  (accountTxResult.data || []).forEach((t: any) => {
    const id = t.account_id;
    if (!accountTxnMap[id]) accountTxnMap[id] = 0;
    accountTxnMap[id] += t.tipo === "income" ? Number(t.valor) : -Number(t.valor);
  });

  const accountsList = (accountsResult.data || []).map((a: any) => ({
    nome: a.nome,
    tipo: a.tipo,
    saldo_inicial: Number(a.saldo_inicial),
    saldo_atual: Number(a.saldo_inicial) + (accountTxnMap[a.id] || 0),
  }));

  // Data quality quick scan
  const semCategoria = rawTransactions.filter((t) => !t.categoria_id).length;
  const sugeridosPendentes = pendingTxns.filter((t) => t.data_status === "suggested").length;
  const incompletosPendentes = pendingTxns.filter((t) => t.data_status === "incomplete").length;
  const inconsistentes = pendingTxns.filter((t) => t.data_status === "inconsistent").length;
  const totalQualityIssues = semCategoria + sugeridosPendentes + incompletosPendentes + inconsistentes;
  const impactoNaPrecisao: "baixo" | "medio" | "alto" = 
    totalQualityIssues === 0 ? "baixo" : 
    totalQualityIssues < 5 ? "medio" : 
    "alto";

  // Padrões por categoria (análise de concentração de gastos)
  const padroesPorCategoria = officialTxns.length > 0
    ? Object.entries(
        officialTxns.reduce((acc, t) => {
          const cat = t.categoria_nome || "Sem categoria";
          if (!acc[cat]) acc[cat] = { total: 0, count: 0 };
          if (t.tipo === "expense") acc[cat].total += t.valor;
          acc[cat].count += 1;
          return acc;
        }, {} as Record<string, { total: number; count: number }>)
      ).map(([categoria, data]) => {
        const budgetItem = budgets.find(b => b.categoria_nome === categoria);
        const totalExpenses = resumoConfirmado?.totalExpense || 1;
        return {
          categoria,
          totalGasto: data.total,
          percentualDasDespesas: (data.total / totalExpenses) * 100,
          statusOrcamento: budgetItem && data.total > budgetItem.valor_planejado ? "acima" : "dentro",
          desvio: budgetItem ? ((data.total - budgetItem.valor_planejado) / budgetItem.valor_planejado) * 100 : undefined,
        };
      })
      .sort((a, b) => b.totalGasto - a.totalGasto)
    : [];

  // Impacto em metas (velocidade de progresso)
  const impactoEmMetas = metas.map(m => {
    const diasNoMes = 30;
    const diasPassados = new Date().getDate();
    const progressoEsperado = (diasPassados / diasNoMes) * 100;
    const velocidadeAtual = m.progressPercent;
    const emRisco = velocidadeAtual < (progressoEsperado * 0.8);
    // Removido: diasParaConcluir (cálculo frágil sem histórico suficiente)
    return { metaNome: m.goalName, velocidadeAtual, emRisco };
  });

  return {
    periodo: { mes, ano },
    escopo: scope,
    resumoMensal,
    resumoConfirmado,
    pendencias: {
      count: pendingTxns.length,
      valorTotal: pendingTxns.reduce((s, t) => s + t.valor, 0),
      tipos: {
        suggested: sugeridosPendentes,
        incomplete: incompletosPendentes,
        inconsistent: inconsistentes,
      },
    },
    orcamento,
    dividas,
    metas,
    previsaoCaixa,
    scoreFinanceiro,
    recorrenciasAtivas: recurrings.length,
    alertasAtivos: {
      total: alertResult.data?.length || 0,
      critical: 0,
      warning: 0,
      info: 0,
    },
    valoresFamiliares: (valuesResult.data || []).map((v: any) => v.descricao),
    qualidadeDados: { semCategoria, sugeridosPendentes, incompletosPendentes, inconsistentes, impactoNaPrecisao },
    contas: accountsList,
    padroesPorCategoria,
    impactoEmMetas,
    reservaEmergencia: reserveConfigured ? {
      valor: reserveValue,
      metaMeses: reserveMonthsTarget,
      despesaMensalRef,
      coberturaMeses: despesaMensalRef > 0 ? Math.round((reserveValue / despesaMensalRef) * 10) / 10 : null,
      statusMeta: !despesaMensalRef ? "ok" : reserveValue < (despesaMensalRef * reserveMonthsTarget) ? "abaixo" : "acima",
    } : null,
    preferenciasUsuario: userPrefs,
    metadados: {
      dataColeta: now.toISOString(),
      versaoEngine: "4.2-final",
      nota: "Todos os valores numéricos foram calculados pela engine determinística. A IA deve apenas interpretar, nunca recalcular. Reserva usa despesa mensal para cobertura. Saldos de contas incluem transações confirmed + null (default oficial).",
      avisoAlucinacao: `PROTOCOLO ZERO-ALUCINAÇÃO: Esta IA foi treinada para NUNCA inventar dados. Se um valor não estiver neste contexto, ela não o criará. Se a qualidade dos dados for '${impactoNaPrecisao}', ela alertará o usuário. Sempre ancore as respostas nos números reais acima.`,
    },
  };
}
