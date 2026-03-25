/**
 * FinanceAI — Mapeadores de Dados
 * Consolidação de todas as conversões de dados do Supabase para tipos internos.
 * Evita duplicação de lógica de mapeamento em páginas/componentes.
 */

import type {
  TransactionRaw,
  BudgetRaw,
  RecurringRaw,
  LoanRaw,
  InstallmentRaw,
  ExtraAmortizationRaw,
  GoalRaw,
  GoalContributionRaw,
} from "./types";

/**
 * Mapeia uma transação do Supabase para TransactionRaw.
 * Garante conversão segura de tipos numéricos.
 */
export function mapTransaction(row: any): TransactionRaw {
  return {
    id: row.id,
    valor: Number(row.valor),
    tipo: row.tipo,
    data: row.data,
    descricao: row.descricao || null,
    categoria_id: row.categoria_id || null,
    categoria_nome: row.categories?.nome || row.categoria_nome || null,
    categoria_icone: row.categories?.icone || row.categoria_icone || null,
    scope: row.scope || null,
    data_status: row.data_status || null,
    source_type: row.source_type || null,
    confidence: row.confidence || null,
    e_mei: row.e_mei || null,
  };
}

/**
 * Mapeia múltiplas transações do Supabase.
 */
export function mapTransactions(rows: any[]): TransactionRaw[] {
  return (rows || []).map(mapTransaction);
}

/**
 * Mapeia um orçamento do Supabase para BudgetRaw.
 */
export function mapBudget(row: any): BudgetRaw {
  return {
    id: row.id,
    categoria_id: row.categoria_id || null,
    categoria_nome: row.categories?.nome || row.categoria_nome || null,
    categoria_icone: row.categories?.icone || row.categoria_icone || null,
    valor_planejado: Number(row.valor_planejado),
    mes: row.mes,
    ano: row.ano,
    scope: row.scope || null,
  };
}

/**
 * Mapeia múltiplos orçamentos do Supabase.
 */
export function mapBudgets(rows: any[]): BudgetRaw[] {
  return (rows || []).map(mapBudget);
}

/**
 * Mapeia uma transação recorrente do Supabase para RecurringRaw.
 */
export function mapRecurring(row: any): RecurringRaw {
  return {
    id: row.id,
    descricao: row.descricao,
    valor: Number(row.valor),
    tipo: row.tipo,
    frequencia: row.frequencia || null,
    dia_mes: row.dia_mes || null,
    ativa: row.ativa || null,
    categoria_id: row.categoria_id || null,
    scope: row.scope || null,
  };
}

/**
 * Mapeia múltiplas transações recorrentes do Supabase.
 */
export function mapRecurrings(rows: any[]): RecurringRaw[] {
  return (rows || []).map(mapRecurring);
}

/**
 * Mapeia um empréstimo do Supabase para LoanRaw.
 */
export function mapLoan(row: any): LoanRaw {
  return {
    id: row.id,
    nome: row.nome,
    valor_original: Number(row.valor_original),
    saldo_devedor: row.saldo_devedor ? Number(row.saldo_devedor) : null,
    taxa_juros_mensal: row.taxa_juros_mensal ? Number(row.taxa_juros_mensal) : null,
    cet_anual: row.cet_anual ? Number(row.cet_anual) : null,
    parcelas_total: row.parcelas_total || null,
    parcelas_restantes: row.parcelas_restantes || null,
    valor_parcela: row.valor_parcela ? Number(row.valor_parcela) : null,
    metodo_amortizacao: row.metodo_amortizacao || null,
    tipo: row.tipo || null,
    credor: row.credor || null,
    data_inicio: row.data_inicio || null,
    ativo: row.ativo || null,
  };
}

/**
 * Mapeia múltiplos empréstimos do Supabase.
 */
export function mapLoans(rows: any[]): LoanRaw[] {
  return (rows || []).map(mapLoan);
}

/**
 * Mapeia uma parcela do Supabase para InstallmentRaw.
 */
export function mapInstallment(row: any): InstallmentRaw {
  return {
    id: row.id,
    emprestimo_id: row.emprestimo_id,
    numero: row.numero,
    valor: Number(row.valor),
    data_vencimento: row.data_vencimento,
    data_pagamento: row.data_pagamento || null,
    status: row.status || null,
  };
}

/**
 * Mapeia múltiplas parcelas do Supabase.
 */
export function mapInstallments(rows: any[]): InstallmentRaw[] {
  return (rows || []).map(mapInstallment);
}

/**
 * Mapeia uma amortização extra do Supabase para ExtraAmortizationRaw.
 */
export function mapExtraAmortization(row: any): ExtraAmortizationRaw {
  return {
    id: row.id,
    emprestimo_id: row.emprestimo_id,
    valor: Number(row.valor),
    data: row.data,
    economia_juros_calculada: row.economia_juros_calculada
      ? Number(row.economia_juros_calculada)
      : null,
  };
}

/**
 * Mapeia múltiplas amortizações extras do Supabase.
 */
export function mapExtraAmortizations(rows: any[]): ExtraAmortizationRaw[] {
  return (rows || []).map(mapExtraAmortization);
}

/**
 * Mapeia uma meta do Supabase para GoalRaw.
 */
export function mapGoal(row: any): GoalRaw {
  return {
    id: row.id,
    nome: row.nome,
    valor_alvo: Number(row.valor_alvo),
    valor_atual: row.valor_atual != null ? Number(row.valor_atual) : null,
    prazo: row.prazo || null,
    prioridade: row.prioridade || null,
    ativo: row.ativo || null,
  };
}

/**
 * Mapeia múltiplas metas do Supabase.
 */
export function mapGoals(rows: any[]): GoalRaw[] {
  return (rows || []).map(mapGoal);
}

/**
 * Mapeia uma contribuição a meta do Supabase para GoalContributionRaw.
 */
export function mapGoalContribution(row: any): GoalContributionRaw {
  return {
    id: row.id,
    goal_id: row.goal_id,
    valor: Number(row.valor),
    data: row.data,
  };
}

/**
 * Mapeia múltiplas contribuições a metas do Supabase.
 */
export function mapGoalContributions(rows: any[]): GoalContributionRaw[] {
  return (rows || []).map(mapGoalContribution);
}

/**
 * Mapeia um resultado de query paralela do Supabase.
 * Útil para consolidar múltiplas queries em um único objeto.
 */
export function mapFinancialDataBatch(batch: {
  transactions?: any[];
  budgets?: any[];
  recurrings?: any[];
  loans?: any[];
  installments?: any[];
  amortizations?: any[];
  goals?: any[];
  contributions?: any[];
}) {
  return {
    transactions: mapTransactions(batch.transactions || []),
    budgets: mapBudgets(batch.budgets || []),
    recurrings: mapRecurrings(batch.recurrings || []),
    loans: mapLoans(batch.loans || []),
    installments: mapInstallments(batch.installments || []),
    amortizations: mapExtraAmortizations(batch.amortizations || []),
    goals: mapGoals(batch.goals || []),
    contributions: mapGoalContributions(batch.contributions || []),
  };
}
