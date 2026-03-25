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

// --- Fase 12: Tipos de memória de progresso, decisão guiada e assinaturas ---

export interface ProgressoMemoriaItem {
  label: string;
  detail: string;
}

export interface ProgressoMemoria {
  available: boolean;
  summary: string[];
  improved: ProgressoMemoriaItem[];
  worsened: ProgressoMemoriaItem[];
  repeated: ProgressoMemoriaItem[];
  limitations: string[];
}

export interface AssinaturasResumo {
  totalAtivas: number;
  totalMensal: number;
  principais: Array<{ nome: string; valorMensal: number }>;
}

export interface DecisaoGuiada {
  pressaoDoMes: "low" | "medium" | "high";
  prioridadeAtual: "protect_cash" | "advance_goal" | "review_recurring_costs" | "stabilize_month";
  sensibilidadeCompra: "low" | "medium" | "high";
  pressaoCustoRecorrente: "low" | "medium" | "high";
  cuidadoAntecipacaoDivida: "low" | "medium" | "high";
  principalMotivo: string;
  sinais: string[];
  topMetaEmRisco: { nome: string; progressoAtual: number; faltante: number } | null;
  oQueMudaria: string[];
}

// --- Fim Fase 12 ---

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
  preferenciasUsuario: Record<string, unknown>;
  metadados: {
    dataColeta: string;
    versaoEngine: string;
    nota: string;
    avisoAlucinacao: string;
  };
  userIntentHint: "escape_red" | "goal" | "reserve" | "purchase" | "cutting" | "checklist" | "weekly_review" | "monthly_focus" | "progress" | "decision" | "generic";
  assinaturas?: {
    totalMensal: number;
    totalAnual: number;
    quantidadeAtiva: number;
    assinaturaMaisCara: { nome_servico: string; valor_mensal: number } | null;
    leaks: Array<{
      type: string;
      severity: string;
      message: string;
    }>;
  };
  // Fase 12
  progressoMemoria: ProgressoMemoria;
  assinaturasResumo: AssinaturasResumo | null;
  decisaoGuiada: DecisaoGuiada;
}

export async function getFinancialContext(
  userId: string,
  scope: string = "all",
  month?: number,
  year?: number
): Promise<FinancialContext> {
  const scopeTyped = scope as "private" | "family" | "business";
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
    accountTxResult, prevTxResult, prevAlertResult,
  ] = await Promise.all([
    (() => {
      let q = supabase.from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)")
        .gte("data", startOfMonth).lte("data", endOfMonth);
      if (scope !== "all") q = q.eq("scope", scopeTyped);
      return q;
    })(),
    (() => {
      let q = supabase.from("budgets")
        .select("id, categoria_id, valor_planejado, mes, ano, scope, categories(nome, icone)")
        .eq("mes", mes).eq("ano", ano);
      if (scope !== "all") q = q.eq("scope", scopeTyped);
      return q;
    })(),
    (() => {
      let q = supabase.from("recurring_transactions")
        .select("id, descricao, valor, tipo, frequencia, dia_mes, ativa, categoria_id, scope")
        .eq("ativa", true);
      if (scope !== "all") q = q.eq("scope", scopeTyped);
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
    // PHASE 4.2: Align with engine — confirmed + null = official
    supabase.from("transactions")
      .select("account_id, tipo, valor, data_status")
      .not("account_id", "is", null)
      .or("data_status.eq.confirmed,data_status.is.null"),
    // Fase 12: mês anterior para comparação honesta
    (() => {
      const prevMes = mes === 1 ? 12 : mes - 1;
      const prevAno = mes === 1 ? ano - 1 : ano;
      const prevStart = new Date(prevAno, prevMes - 1, 1).toISOString().split("T")[0];
      const prevEnd = new Date(prevAno, prevMes, 0).toISOString().split("T")[0];
      let q = supabase.from("transactions")
        .select("id, valor, tipo, data, data_status, categoria_id, categories(nome), scope")
        .gte("data", prevStart).lte("data", prevEnd)
        .or("data_status.eq.confirmed,data_status.is.null");
      if (scope !== "all") q = q.eq("scope", scopeTyped);
      return q;
    })(),
    // Fase 12: alertas do mês anterior (snapshot via lidos)
    supabase.from("alerts").select("id, nivel").eq("lido", true).limit(50),
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
  const resumoMensal = rawTransactions.length > 0 ? await calculateMonthlySummary(rawTransactions) : null;
  const resumoConfirmado = officialTxns.length > 0 ? await calculateMonthlySummary(officialTxns) : null;

  const orcamento = budgets.length > 0
    ? await calculateBudgetDeviation(budgets, rawTransactions)
    : null;

  const dividas = loans.length > 0
    ? await calculateLoanIndicators(loans, installments)
    : null;

  const metas = await calculateGoalProgress(goals, contributions);

  // Forecast — uses balance from confirmed data
  const saldoAtual = resumoConfirmado ? resumoConfirmado.balance : 0;
  const previsaoCaixa = recurrings.length > 0 || installments.length > 0
    ? await calculateCashflowForecast({
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
    ? await calculateHealthScore({
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
        
        // PHASE 6: Refined pressure analysis
        // A category "pressures" if it's over budget OR represents > 20% of expenses
        const isPressuring = isOverBudget || percentualDasDespesas > 20;

        return {
          categoria,
          totalGasto: data.total,
          percentualDasDespesas,
          statusOrcamento: (isOverBudget ? "acima" : "dentro") as "acima" | "dentro",
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
    
    // Classificação qualitativa baseada em fatos, não em projeção temporal frágil
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

  // Pre-compute alertasAtivos and reservaEmergencia for use in nested functions
  const alertasAtivos = {
    total: alertResult.data?.length || 0,
    critical: (alertResult.data || []).filter((a: any) => a.nivel === "critical").length,
    warning: (alertResult.data || []).filter((a: any) => a.nivel === "warning").length,
    info: (alertResult.data || []).filter((a: any) => a.nivel === "info").length,
    topAlerts: (alertResult.data || []).slice(0, 3).map((a: any) => a.titulo),
  };

  const reservaEmergencia = reserveConfigured ? {
    valor: reserveValue,
    metaMeses: reserveMonthsTarget,
    despesaMensalRef,
    coberturaMeses: despesaMensalRef > 0 ? Math.round((reserveValue / despesaMensalRef) * 10) / 10 : null,
    statusMeta: (!despesaMensalRef ? "ok" : reserveValue < (despesaMensalRef * reserveMonthsTarget) ? "abaixo" : "acima") as "abaixo" | "ok" | "acima",
  } : null;

  // --- Fase 12: Memória de progresso (comparação honesta mês atual vs anterior) ---

  const prevRawTx: TransactionRaw[] = (prevTxResult.data || []).map((t: any) => ({
    id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data,
    descricao: "", categoria_id: t.categoria_id, categoria_nome: t.categories?.nome,
    scope: t.scope, data_status: t.data_status,
    source_type: undefined, confidence: undefined, e_mei: undefined,
  }));

  const prevSummary = prevRawTx.length > 0 ? await calculateMonthlySummary(prevRawTx) : null;
  const prevAlerts = prevAlertResult.data || [];

  function buildProgressoMemoria(): ProgressoMemoria {
    const limitations: string[] = [];
    const improved: ProgressoMemoriaItem[] = [];
    const worsened: ProgressoMemoriaItem[] = [];
    const repeated: ProgressoMemoriaItem[] = [];
    const summary: string[] = [];

    if (!prevSummary || !resumoConfirmado) {
      limitations.push("Sem dados do mês anterior para comparar com segurança.");
      return { available: false, summary, improved, worsened, repeated, limitations };
    }

    const scoreAtual = scoreFinanceiro?.scoreGeral ?? null;

    const saldoPrev = prevSummary.balance;
    const saldoAtual = resumoConfirmado.balance;
    const saldoDiff = saldoAtual - saldoPrev;
    if (Math.abs(saldoDiff) > 10) {
      if (saldoDiff > 0) {
        improved.push({ label: "Saldo", detail: `R$ ${saldoDiff.toFixed(2)} melhor que mês anterior` });
      } else {
        worsened.push({ label: "Saldo", detail: `R$ ${Math.abs(saldoDiff).toFixed(2)} pior que mês anterior` });
      }
    }

    const despPrev = prevSummary.totalExpense;
    const despAtual = resumoConfirmado.totalExpense;
    const despDiff = despAtual - despPrev;
    if (Math.abs(despDiff) > 10) {
      if (despDiff < 0) {
        improved.push({ label: "Gastos totais", detail: `R$ ${Math.abs(despDiff).toFixed(2)} menos que mês anterior` });
      } else {
        worsened.push({ label: "Gastos totais", detail: `R$ ${despDiff.toFixed(2)} a mais que mês anterior` });
      }
    }

    const alertasCriticosAgora = alertasAtivos.critical;
    const alertasLidosCriticos = prevAlerts.filter((a: any) => a.nivel === "critical").length;
    if (alertasCriticosAgora === 0 && alertasLidosCriticos > 0) {
      improved.push({ label: "Alertas críticos", detail: "Sem alertas críticos ativos agora" });
    } else if (alertasCriticosAgora > 0 && alertasCriticosAgora > alertasLidosCriticos) {
      worsened.push({ label: "Alertas críticos", detail: `${alertasCriticosAgora} alertas críticos ativos` });
    }

    if (reservaEmergencia) {
      if (reservaEmergencia.statusMeta === "abaixo") {
        repeated.push({ label: "Reserva de emergência", detail: "continua abaixo da meta" });
      } else {
        improved.push({ label: "Reserva de emergência", detail: `${reservaEmergencia.coberturaMeses} meses cobertos` });
      }
    }

    const taxaPrev = prevSummary.savingsRate;
    const taxaAtual = resumoConfirmado.savingsRate;
    if (Math.abs(taxaAtual - taxaPrev) > 2) {
      if (taxaAtual > taxaPrev) {
        improved.push({ label: "Taxa de economia", detail: `${taxaAtual.toFixed(1)}% vs ${taxaPrev.toFixed(1)}% no mês anterior` });
      } else {
        worsened.push({ label: "Taxa de economia", detail: `${taxaAtual.toFixed(1)}% vs ${taxaPrev.toFixed(1)}% no mês anterior` });
      }
    }

    const catsPressuring = padroesPorCategoria.filter(p => p.isPressuring).map(p => p.categoria);
    if (catsPressuring.length > 0) {
      repeated.push({ label: "Categorias pressionando", detail: catsPressuring.slice(0, 3).join(", ") });
    }

    if (scoreAtual !== null) summary.push(`Score financeiro atual: ${scoreAtual}/100`);
    summary.push(`Saldo confirmado: R$ ${saldoAtual.toFixed(2)} (anterior: R$ ${saldoPrev.toFixed(2)})`);
    summary.push(`Despesa confirmada: R$ ${despAtual.toFixed(2)} (anterior: R$ ${despPrev.toFixed(2)})`);

    if (improved.length === 0 && worsened.length === 0) {
      limitations.push("Variação entre meses muito pequena para afirmar tendência.");
    }

    return { available: true, summary, improved, worsened, repeated, limitations };
  }

  // --- Fase 12: Decisão Guiada ---
  function buildDecisaoGuiada(): DecisaoGuiada {
    const score = scoreFinanceiro?.scoreGeral ?? 50;
    const saldo = resumoConfirmado?.balance ?? 0;
    const catsPressuring = padroesPorCategoria.filter(p => p.isPressuring);
    const reservaBaixa = reservaEmergencia?.statusMeta === "abaixo";
    const alertasCriticos = alertasAtivos.critical > 0;
    const temDivida = (dividas?.totalSaldoDevedor ?? 0) > 0;
    const sinais: string[] = [];

    let pressaoDoMes: "low" | "medium" | "high" = "low";
    if (alertasCriticos || score < 40 || saldo < 0) pressaoDoMes = "high";
    else if (catsPressuring.length > 0 || reservaBaixa) pressaoDoMes = "medium";

    let prioridadeAtual: DecisaoGuiada["prioridadeAtual"] = "stabilize_month";
    if (saldo < 0 || alertasCriticos) {
      prioridadeAtual = "protect_cash";
    } else if (reservaBaixa) {
      prioridadeAtual = "protect_cash";
      sinais.push("Reserva abaixo da meta");
    } else if (catsPressuring.length > 2) {
      prioridadeAtual = "review_recurring_costs";
      sinais.push(`${catsPressuring.length} categorias pressionando`);
    } else if (impactoEmMetas.some(m => m.hasProgress && m.progressoAtual > 10 && m.progressoAtual < 90)) {
      prioridadeAtual = "advance_goal";
    }

    const sensibilidadeCompra: "low" | "medium" | "high" =
      pressaoDoMes === "high" ? "high" : pressaoDoMes === "medium" ? "medium" : "low";

    const pressaoCustoRecorrente: "low" | "medium" | "high" =
      catsPressuring.length > 1 ? "high" : catsPressuring.length === 1 ? "medium" : "low";

    const cuidadoAntecipacaoDivida: "low" | "medium" | "high" =
      saldo < 500 || reservaBaixa ? "high" : temDivida ? "medium" : "low";

    let principalMotivo = "Contexto financeiro estável.";
    if (saldo < 0) principalMotivo = "Saldo negativo — prioridade absoluta: estabilizar caixa.";
    else if (alertasCriticos) principalMotivo = "Alertas críticos ativos — resolver antes de qualquer decisão nova.";
    else if (reservaBaixa) principalMotivo = "Reserva de emergência abaixo da meta.";
    else if (catsPressuring.length > 0) principalMotivo = `${catsPressuring[0].categoria} está pressionando o orçamento.`;

    const topMetaEmRisco = impactoEmMetas.length > 0
      ? impactoEmMetas
          .filter(m => m.faltante > 0)
          .sort((a, b) => a.progressoAtual - b.progressoAtual)
          .map(m => ({ nome: m.metaNome, progressoAtual: m.progressoAtual, faltante: m.faltante }))[0] ?? null
      : null;

    const oQueMudaria: string[] = [];
    if (reservaBaixa) oQueMudaria.push("Reserva atingir meta liberaria foco para meta");
    if (catsPressuring.length > 0) oQueMudaria.push("Redução das categorias pressionando");
    if (alertasCriticos) oQueMudaria.push("Resolução dos alertas críticos");

    return {
      pressaoDoMes, prioridadeAtual, sensibilidadeCompra,
      pressaoCustoRecorrente, cuidadoAntecipacaoDivida,
      principalMotivo, sinais, topMetaEmRisco, oQueMudaria,
    };
  }

  // --- Fase 12: Assinaturas Resumo (derivado de recorrentes de despesa) ---
  function buildAssinaturasResumo(): AssinaturasResumo | null {
    const recorrentesDesp = recurrings.filter(r => r.tipo === "expense" && r.ativa);
    if (recorrentesDesp.length === 0) return null;
    const totalMensal = recorrentesDesp.reduce((s, r) => s + r.valor, 0);
    const principais = recorrentesDesp
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3)
      .map(r => ({ nome: r.descricao, valorMensal: r.valor }));
    return { totalAtivas: recorrentesDesp.length, totalMensal, principais };
  }

  const progressoMemoria = buildProgressoMemoria();
  const decisaoGuiada = buildDecisaoGuiada();
  const assinaturasResumo = buildAssinaturasResumo();

  // --- Fim Fase 12 ---

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
    alertasAtivos,
    valoresFamiliares: (valuesResult.data || []).map((v: any) => v.descricao),
    qualidadeDados: { semCategoria, sugeridosPendentes, incompletosPendentes, inconsistentes, impactoNaPrecisao },
    contas: accountsList,
    padroesPorCategoria,
    impactoEmMetas,
    reservaEmergencia,
    preferenciasUsuario: userPrefs,
    userIntentHint: "generic",
    assinaturas: undefined, // Will be populated by caller if needed
    // Fase 12
    progressoMemoria,
    assinaturasResumo,
    decisaoGuiada,
    metadados: {
      dataColeta: now.toISOString(),
      versaoEngine: "4.2-final",
      nota: "Todos os valores numéricos foram calculados pela engine determinística. A IA deve apenas interpretar, nunca recalcular. Reserva usa despesa mensal para cobertura. Saldos de contas incluem transações confirmed + null (default oficial).",
      avisoAlucinacao: `PROTOCOLO ZERO-ALUCINAÇÃO: Esta IA foi treinada para NUNCA inventar dados. Se um valor não estiver neste contexto, ela não o criará. Se a qualidade dos dados for '${impactoNaPrecisao}', ela alertará o usuário. Sempre ancore as respostas nos números reais acima.`,
    },
  };
}
