/**
 * FinanceAI — Fase 10 — Coleta de Contexto para IA Conselheira
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

type ProgressSignalDirection = "improved" | "worsened" | "stable";
type ProgressSignalKind = "pending" | "score" | "reserve" | "savings" | "goal";

interface ProgressSignal {
  kind: ProgressSignalKind;
  direction: ProgressSignalDirection;
  label: string;
  detail: string;
}

interface ProgressSnapshot {
  periodLabel: string;
  source: "recent_period" | "last_review";
  referenceDate?: string | null;
  scoreGeral: number | null;
  pendenciasCount: number;
  coberturaReservaMeses: number | null;
  taxaEconomia: number | null;
  metasComProgresso: Array<{ nome: string; progressoPercent: number }>;
}

interface ProgressMemory {
  available: boolean;
  summary: string[];
  limitations: string[];
  currentSnapshot: ProgressSnapshot;
  recentPeriodSnapshot: ProgressSnapshot | null;
  lastReviewSnapshot: ProgressSnapshot | null;
  improved: ProgressSignal[];
  worsened: ProgressSignal[];
  repeated: ProgressSignal[];
}

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
  alertasAtivos: { total: number; critical: number; warning: number; info: number; topAlerts: string[] };
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
    isPressuring: boolean;
  }>;
  impactoEmMetas: Array<{
    metaNome: string;
    progressoAtual: number;
    ritmo: "inicial" | "em andamento" | "avançado";
    acumulado: number;
    faltante: number;
    isNew: boolean;
    hasProgress: boolean;
  }>;
  progressoMemoria: ProgressMemory;
  preferenciasUsuario: Record<string, unknown>;
  metadados: {
    dataColeta: string;
    versaoEngine: string;
    nota: string;
    avisoAlucinacao: string;
  };
  userIntentHint: "escape_red" | "goal" | "reserve" | "purchase" | "cutting" | "checklist" | "weekly_review" | "monthly_focus" | "progress" | "generic";
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

  const previousMonthDate = new Date(ano, mes - 2, 1);
  const previousMonth = previousMonthDate.getMonth() + 1;
  const previousYear = previousMonthDate.getFullYear();
  const prevStart = new Date(previousYear, previousMonth - 1, 1).toISOString().split("T")[0];
  const prevEnd = new Date(previousYear, previousMonth, 0).toISOString().split("T")[0];

  // Fetch all data in parallel
  const [
    txResult, budgetResult, recurringResult, loanResult,
    installmentResult, amortResult, goalResult, contribResult,
    alertResult, valuesResult, accountsResult, profileResult,
    accountTxResult, prevTxResult, prevBudgetResult, prevHealthScoreResult,
    lastReviewResult,
  ] = await Promise.all([
    (() => {
      let q = supabase.from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)")
        .gte("data", startOfMonth).lte("data", endOfMonth);
      if (scope !== "all") q = q.eq("scope", scope as any);
      return q;
    })(),
    (() => {
      let q = supabase.from("budgets")
        .select("id, categoria_id, valor_planejado, mes, ano, scope, categories(nome, icone)")
        .eq("mes", mes).eq("ano", ano);
      if (scope !== "all") q = q.eq("scope", scope as any);
      return q;
    })(),
    (() => {
      let q = supabase.from("recurring_transactions")
        .select("id, descricao, valor, tipo, frequencia, dia_mes, ativa, categoria_id, scope")
        .eq("ativa", true);
      if (scope !== "all") q = q.eq("scope", scope as any);
      return q;
    })(),
    supabase.from("loans").select("*").eq("ativo", true),
    supabase.from("loan_installments").select("*").gte("data_vencimento", startOfMonth),
    supabase.from("extra_amortizations").select("*"),
    supabase.from("goals").select("*").eq("ativo", true),
    supabase.from("goal_contributions").select("*"),
    supabase.from("alerts").select("id, nivel, titulo").eq("lido", false),
    supabase.from("family_values").select("descricao"),
    supabase.from("accounts").select("*").eq("ativa", true),
    supabase.from("profiles").select("preferences").eq("user_id", userId).single(),
    supabase.from("transactions")
      .select("account_id, tipo, valor, data_status")
      .not("account_id", "is", null)
      .or("data_status.eq.confirmed,data_status.is.null"),
    (() => {
      let q = supabase.from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)")
        .gte("data", prevStart).lte("data", prevEnd);
      if (scope !== "all") q = q.eq("scope", scope as any);
      return q;
    })(),
    (() => {
      let q = supabase.from("budgets")
        .select("id, categoria_id, valor_planejado, mes, ano, scope, categories(nome, icone)")
        .eq("mes", previousMonth).eq("ano", previousYear);
      if (scope !== "all") q = q.eq("scope", scope as any);
      return q;
    })(),
    supabase.from("health_scores").select("score_geral, mes, ano, created_at").eq("mes", previousMonth).eq("ano", previousYear).order("created_at", { ascending: false }).limit(1),
    supabase.from("ai_messages").select("created_at, contexto_enviado").eq("user_id", userId).eq("role", "user").not("contexto_enviado", "is", null).order("created_at", { ascending: false }).limit(20),
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
  const reservaEmergencia = reserveConfigured ? {
    valor: reserveValue,
    metaMeses: reserveMonthsTarget,
    despesaMensalRef,
    coberturaMeses: despesaMensalRef > 0 ? Math.round((reserveValue / despesaMensalRef) * 10) / 10 : null,
    statusMeta: !despesaMensalRef ? "ok" : reserveValue < (despesaMensalRef * reserveMonthsTarget) ? "abaixo" : "acima",
  } : null;

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
        const isOverBudget = budgetItem && data.total > budgetItem.valor_planejado;
        const percentualDasDespesas = (data.total / totalExpenses) * 100;
        
        const isPressuring = isOverBudget || percentualDasDespesas > 20;

        return {
          categoria,
          totalGasto: data.total,
          percentualDasDespesas,
          statusOrcamento: isOverBudget ? "acima" : "dentro",
          desvio: budgetItem ? ((data.total - budgetItem.valor_planejado) / budgetItem.valor_planejado) * 100 : undefined,
          isPressuring,
        };
      })
      .sort((a, b) => b.totalGasto - a.totalGasto)
    : [];

  // Impacto em metas (ritmo qualitativo e honesto)
  const impactoEmMetas = metas.map(m => {
    const hasProgress = m.totalContributed > 0;
    const isNew = m.progressPercent < 5;
    const isSignificant = m.progressPercent > 50;
    
    let ritmo: "inicial" | "em andamento" | "avançado" = "inicial";
    if (isSignificant) ritmo = "avançado";
    else if (hasProgress) ritmo = "em andamento";
    
    return { 
      metaNome: m.goalName, 
      progressoAtual: m.progressPercent,
      ritmo,
      acumulado: m.totalContributed,
      faltante: m.remainingAmount,
      isNew,
      hasProgress
    };
  });

  const prevRawTransactions: TransactionRaw[] = (prevTxResult.data || []).map((t: any) => ({
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

  const prevBudgets: BudgetRaw[] = (prevBudgetResult.data || []).map((b: any) => ({
    id: b.id,
    categoria_id: b.categoria_id,
    categoria_nome: b.categories?.nome,
    categoria_icone: b.categories?.icone,
    valor_planejado: Number(b.valor_planejado),
    mes: b.mes,
    ano: b.ano,
    scope: b.scope,
  }));

  const prevOfficialTxns = filterOfficialTransactions(prevRawTransactions);
  const prevPendingTxns = filterPendingTransactions(prevRawTransactions);
  const prevResumoConfirmado = prevOfficialTxns.length > 0 ? calculateMonthlySummary(prevOfficialTxns) : null;
  const prevOrcamento = prevBudgets.length > 0 ? calculateBudgetDeviation(prevBudgets, prevRawTransactions, previousMonth, previousYear) : null;
  const prevReserveExpenseRef = prevResumoConfirmado?.totalExpense || 0;
  const prevReserveCoverage = reserveConfigured && prevReserveExpenseRef > 0 ? Math.round((reserveValue / prevReserveExpenseRef) * 10) / 10 : null;
  const prevScore = prevHealthScoreResult.data?.[0]?.score_geral != null
    ? Number(prevHealthScoreResult.data[0].score_geral)
    : (prevResumoConfirmado ? calculateHealthScore({
        totalIncome: prevResumoConfirmado.totalIncome,
        totalExpense: prevResumoConfirmado.totalExpense,
        totalDebt: dividas?.totalSaldoDevedor || 0,
        emergencyReserve: reserveValue,
        emergencyReserveConfigured: reserveConfigured,
        budgetConfigured: prevBudgets.length > 0,
        budgetDeviation: prevOrcamento ? Math.max(0, prevOrcamento.totalDeviationPercent) : 0,
        overdueInstallments,
        totalInstallments: installments.length,
        monthsWithData: 1,
        totalMonthsPossible: 1,
      }).scoreGeral : null);

  const currentSnapshot: ProgressSnapshot = {
    periodLabel: `${String(mes).padStart(2, "0")}/${ano}`,
    source: "recent_period",
    scoreGeral: scoreFinanceiro?.scoreGeral ?? null,
    pendenciasCount: pendingTxns.length,
    coberturaReservaMeses: reservaEmergencia?.coberturaMeses ?? null,
    taxaEconomia: resumoConfirmado?.savingsRate ?? null,
    metasComProgresso: impactoEmMetas.filter(m => m.hasProgress).map(m => ({ nome: m.metaNome, progressoPercent: m.progressoAtual })),
  };

  const recentPeriodSnapshot: ProgressSnapshot | null = (prevResumoConfirmado || prevPendingTxns.length > 0 || prevScore !== null)
    ? {
        periodLabel: `${String(previousMonth).padStart(2, "0")}/${previousYear}`,
        source: "recent_period",
        scoreGeral: prevScore,
        pendenciasCount: prevPendingTxns.length,
        coberturaReservaMeses: prevReserveCoverage,
        taxaEconomia: prevResumoConfirmado?.savingsRate ?? null,
        metasComProgresso: [],
      }
    : null;

  const matchingReview = (lastReviewResult.data || []).find((row: any) => {
    const ctx = row.contexto_enviado;
    return ctx && ctx.escopo === scope && ctx.periodo?.mes === mes && ctx.periodo?.ano === ano;
  });

  const lastReviewSnapshot: ProgressSnapshot | null = matchingReview?.contexto_enviado
    ? {
        periodLabel: `${String(matchingReview.contexto_enviado.periodo?.mes || mes).padStart(2, "0")}/${matchingReview.contexto_enviado.periodo?.ano || ano}`,
        source: "last_review",
        referenceDate: matchingReview.created_at,
        scoreGeral: matchingReview.contexto_enviado?.scoreFinanceiro?.scoreGeral ?? null,
        pendenciasCount: matchingReview.contexto_enviado?.pendencias?.count ?? 0,
        coberturaReservaMeses: matchingReview.contexto_enviado?.reservaEmergencia?.coberturaMeses ?? null,
        taxaEconomia: matchingReview.contexto_enviado?.resumoConfirmado?.savingsRate ?? null,
        metasComProgresso: (matchingReview.contexto_enviado?.impactoEmMetas || [])
          .filter((m: any) => m?.hasProgress)
          .map((m: any) => ({ nome: m.metaNome, progressoPercent: Number(m.progressoAtual) })),
      }
    : null;

  const progressoMemoria = buildProgressMemory({
    now,
    current: currentSnapshot,
    recentPeriod: recentPeriodSnapshot,
    lastReview: lastReviewSnapshot,
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
      critical: (alertResult.data || []).filter(a => a.nivel === "critical").length,
      warning: (alertResult.data || []).filter(a => a.nivel === "warning").length,
      info: (alertResult.data || []).filter(a => a.nivel === "info").length,
      topAlerts: (alertResult.data || []).slice(0, 3).map(a => a.titulo),
    },
    valoresFamiliares: (valuesResult.data || []).map((v: any) => v.descricao),
    qualidadeDados: { semCategoria, sugeridosPendentes, incompletosPendentes, inconsistentes, impactoNaPrecisao },
    contas: accountsList,
    padroesPorCategoria: padroesPorCategoria as any,
    impactoEmMetas: impactoEmMetas as any,
    progressoMemoria: progressoMemoria as any,
    reservaEmergencia,
    preferenciasUsuario: userPrefs,
    userIntentHint: "generic",
    metadados: {
      dataColeta: now.toISOString(),
      versaoEngine: "10.0-progress-memory",
      nota: "Todos os valores numéricos foram calculados pela engine determinística. A IA deve apenas interpretar, nunca recalcular. Reserva usa despesa mensal para cobertura. Saldos de contas incluem transações confirmed + null (default oficial). A leitura de progresso compara o agora com período recente e última revisão quando houver base real.",
      avisoAlucinacao: `PROTOCOLO ZERO-ALUCINAÇÃO: Esta IA foi treinada para NUNCA inventar dados. Se um valor não estiver neste contexto, ela não o criará. Se a qualidade dos dados for '${impactoNaPrecisao}', ela alertará o usuário. Sempre ancore as respostas nos números reais acima.`,
    },
  };
}

function buildProgressMemory(input: {
  now: Date;
  current: ProgressSnapshot;
  recentPeriod: ProgressSnapshot | null;
  lastReview: ProgressSnapshot | null;
}): ProgressMemory {
  const improved: ProgressSignal[] = [];
  const worsened: ProgressSignal[] = [];
  const repeated: ProgressSignal[] = [];
  const summary: string[] = [];
  const limitations: string[] = [];

  if (!input.recentPeriod && !input.lastReview) {
    limitations.push("Ainda não há base suficiente para comparar este momento com um período anterior ou com uma revisão anterior do mesmo escopo.");
  }

  const comparisonBase = input.lastReview || input.recentPeriod;

  if (!comparisonBase) {
    return {
      available: false,
      summary,
      limitations,
      currentSnapshot: input.current,
      recentPeriodSnapshot: input.recentPeriod,
      lastReviewSnapshot: input.lastReview,
      improved,
      worsened,
      repeated,
    };
  }

  compareNumeric(
    input.current.pendenciasCount,
    comparisonBase.pendenciasCount,
    {
      betterWhen: "lower",
      kind: "pending",
      improvedLabel: "Pendências reduziram",
      worsenedLabel: "Pendências aumentaram",
      repeatedLabel: "Pendências seguem no mesmo patamar",
      format: (current, previous) => `${current} agora vs ${previous} na referência.`,
    },
    improved,
    worsened,
    repeated
  );

  if (input.current.scoreGeral !== null && comparisonBase.scoreGeral !== null) {
    compareNumeric(
      input.current.scoreGeral,
      comparisonBase.scoreGeral,
      {
        betterWhen: "higher",
        kind: "score",
        improvedLabel: "Score financeiro melhorou",
        worsenedLabel: "Score financeiro piorou",
        repeatedLabel: "Score financeiro praticamente não mudou",
        format: (current, previous) => `${Math.round(current)} agora vs ${Math.round(previous)} na referência.`,
      },
      improved,
      worsened,
      repeated,
      1
    );
  } else {
    limitations.push("Não foi possível comparar score financeiro com segurança em toda a base disponível.");
  }

  if (input.current.coberturaReservaMeses !== null && comparisonBase.coberturaReservaMeses !== null) {
    compareNumeric(
      input.current.coberturaReservaMeses,
      comparisonBase.coberturaReservaMeses,
      {
        betterWhen: "higher",
        kind: "reserve",
        improvedLabel: "Cobertura da reserva melhorou",
        worsenedLabel: "Cobertura da reserva piorou",
        repeatedLabel: "Cobertura da reserva segue parecida",
        format: (current, previous) => `${current.toFixed(1)} meses agora vs ${previous.toFixed(1)} na referência.`,
      },
      improved,
      worsened,
      repeated,
      0.1
    );
  }

  if (input.current.taxaEconomia !== null && comparisonBase.taxaEconomia !== null) {
    compareNumeric(
      input.current.taxaEconomia,
      comparisonBase.taxaEconomia,
      {
        betterWhen: "higher",
        kind: "savings",
        improvedLabel: "Taxa de economia melhorou",
        worsenedLabel: "Taxa de economia piorou",
        repeatedLabel: "Taxa de economia segue parecida",
        format: (current, previous) => `${current.toFixed(1)}% agora vs ${previous.toFixed(1)}% na referência.`,
      },
      improved,
      worsened,
      repeated,
      0.5
    );
  }

  const goalSignals = compareGoals(input.current.metasComProgresso, comparisonBase.metasComProgresso);
  improved.push(...goalSignals.improved);
  repeated.push(...goalSignals.repeated);

  if (input.current.pendenciasCount > 0 && comparisonBase.pendenciasCount > 0) {
    repeated.push({
      kind: "pending",
      direction: "stable",
      label: "Pendências continuam exigindo revisão",
      detail: "Ainda há pendências na referência e no momento atual, então a leitura continua parcialmente limitada.",
    });
  }

  if (input.lastReview) {
    summary.push(`Há base para comparar com a última revisão deste mesmo escopo em ${formatDate(input.lastReview.referenceDate)}.`);
  }
  if (input.recentPeriod) {
    summary.push(`Também há base para comparar com o período recente ${input.recentPeriod.periodLabel}.`);
  }
  if (input.now.getDate() < 28) {
    limitations.push("O mês atual ainda está em andamento, então a comparação com período anterior pode mudar até o fechamento.");
  }

  return {
    available: improved.length + worsened.length + repeated.length > 0,
    summary,
    limitations,
    currentSnapshot: input.current,
    recentPeriodSnapshot: input.recentPeriod,
    lastReviewSnapshot: input.lastReview,
    improved,
    worsened,
    repeated,
  };
}

function compareGoals(
  current: Array<{ nome: string; progressoPercent: number }>,
  previous: Array<{ nome: string; progressoPercent: number }>
): { improved: ProgressSignal[]; repeated: ProgressSignal[] } {
  const improved: ProgressSignal[] = [];
  const repeated: ProgressSignal[] = [];

  const previousMap = new Map(previous.map(item => [item.nome, item.progressoPercent]));
  current.forEach((goal) => {
    const previousValue = previousMap.get(goal.nome);
    if (previousValue === undefined) return;
    if (goal.progressoPercent > previousValue + 0.5) {
      improved.push({
        kind: "goal",
        direction: "improved",
        label: `Meta "${goal.nome}" avançou`,
        detail: `${goal.progressoPercent.toFixed(1)}% agora vs ${previousValue.toFixed(1)}% na referência.`,
      });
    } else {
      repeated.push({
        kind: "goal",
        direction: "stable",
        label: `Meta "${goal.nome}" segue quase no mesmo ponto`,
        detail: `${goal.progressoPercent.toFixed(1)}% agora vs ${previousValue.toFixed(1)}% na referência.`,
      });
    }
  });

  return { improved, repeated };
}

function compareNumeric(
  current: number,
  previous: number,
  config: {
    betterWhen: "higher" | "lower";
    kind: ProgressSignalKind;
    improvedLabel: string;
    worsenedLabel: string;
    repeatedLabel: string;
    format: (current: number, previous: number) => string;
  },
  improved: ProgressSignal[],
  worsened: ProgressSignal[],
  repeated: ProgressSignal[],
  tolerance: number = 0
) {
  const diff = current - previous;
  if (Math.abs(diff) <= tolerance) {
    repeated.push({
      kind: config.kind,
      direction: "stable",
      label: config.repeatedLabel,
      detail: config.format(current, previous),
    });
    return;
  }

  const isImproved = config.betterWhen === "higher" ? diff > 0 : diff < 0;
  const target = isImproved ? improved : worsened;
  target.push({
    kind: config.kind,
    direction: isImproved ? "improved" : "worsened",
    label: isImproved ? config.improvedLabel : config.worsenedLabel,
    detail: config.format(current, previous),
  });
}

function formatDate(value?: string | null): string {
  if (!value) return "data não identificada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "data não identificada";
  return date.toLocaleDateString("pt-BR");
}
