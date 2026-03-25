/**
 * FinanceAI — Motor de Fechamento Mensal
 * 
 * Responsabilidades:
 * 1. Validar se um período pode ser fechado (qualidade de dados, pendências)
 * 2. Gerar snapshot consolidado do período
 * 3. Registrar auditoria de fechamento/reabertura
 * 4. Verificar status de período (open, reviewing, closed)
 * 5. Implementar lógica de bloqueio de edições em períodos fechados
 * 
 * REGRA CRÍTICA: Esta engine é DETERMINÍSTICA e NÃO depende de IA.
 * Toda lógica de bloqueio deve ser reforçada no backend/banco.
 */

import type {
  MonthlySummary,
  BudgetDeviationResult,
  HealthScoreResult,
  GoalProgressResult,
} from "./types";
import type { MonthlyClosingReport } from "./contracts";

// ─── Estados e Tipos ─────────────────────────────────────────

export type PeriodStatus = "open" | "reviewing" | "closed";

export interface PeriodLockInfo {
  period: { month: number; year: number };
  status: PeriodStatus;
  isLocked: boolean;
  lockedReason?: string;
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
}

export interface ClosingValidation {
  canClose: boolean;
  issues: ClosingIssue[];
  warnings: ClosingWarning[];
  readinessScore: number; // 0-100
}

export interface ClosingIssue {
  type:
    | "high_pending_transactions"
    | "missing_categories"
    | "inconsistent_data"
    | "unconfirmed_budget"
    | "incomplete_goals"
    | "incomplete_loans";
  severity: "critical" | "warning" | "info";
  message: string;
  count: number;
  actionUrl?: string;
}

export interface ClosingWarning {
  type: string;
  message: string;
  severity: "warning" | "info";
}

export interface ClosingSnapshot {
  period: { month: number; year: number };
  status: PeriodStatus;
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  summary: MonthlySummary | null;
  budget: BudgetDeviationResult | null;
  health: HealthScoreResult | null;
  goals: GoalProgressResult[];
  dataQuality: {
    transactionsWithoutCategory: number;
    suggestedPending: number;
    incompletePending: number;
    inconsistentPending: number;
    overallHealth: "good" | "needs_attention" | "critical";
  };
}

// ─── Validação de Fechamento ────────────────────────────────

/**
 * Valida se um período pode ser fechado.
 * Retorna lista de problemas críticos e avisos.
 */
export function validateClosing(
  summary: MonthlySummary | null,
  budget: BudgetDeviationResult | null,
  pendingTransactions: number,
  noCategoryCount: number,
  inconsistentCount: number,
  goalsProgress: GoalProgressResult[],
): ClosingValidation {
  const issues: ClosingIssue[] = [];
  const warnings: ClosingWarning[] = [];

  // 1. Transações pendentes (sugeridas, incompletas)
  if (pendingTransactions >= 5) {
    issues.push({
      type: "high_pending_transactions",
      severity: "critical",
      message: `${pendingTransactions} transações pendentes de confirmação. Revise antes de fechar.`,
      count: pendingTransactions,
      actionUrl: "/transacoes",
    });
  } else if (pendingTransactions > 0) {
    warnings.push({
      type: "pending_transactions",
      message: `${pendingTransactions} transação(ões) pendente(s) — serão congeladas neste estado.`,
      severity: "warning",
    });
  }

  // 2. Transações sem categoria
  if (noCategoryCount >= 5) {
    issues.push({
      type: "missing_categories",
      severity: "warning",
      message: `${noCategoryCount} transações sem categoria. Dificulta análise orçamentária.`,
      count: noCategoryCount,
      actionUrl: "/transacoes",
    });
  } else if (noCategoryCount > 0) {
    warnings.push({
      type: "missing_categories",
      message: `${noCategoryCount} transação(ões) sem categoria — recomenda-se categorizar.`,
      severity: "info",
    });
  }

  // 3. Dados inconsistentes
  if (inconsistentCount > 0) {
    issues.push({
      type: "inconsistent_data",
      severity: "critical",
      message: `${inconsistentCount} transação(ões) com dados inconsistentes detectadas. Corrija antes de fechar.`,
      count: inconsistentCount,
      actionUrl: "/transacoes",
    });
  }

  // 4. Orçamento não confirmado
  if (budget && budget.overallStatus === "exceeded") {
    warnings.push({
      type: "budget_exceeded",
      message: "Orçamento foi ultrapassado em categorias críticas. Revise se necessário.",
      severity: "warning",
    });
  }

  // 5. Metas em risco
  const atRiskGoals = goalsProgress.filter(g => !g.isOnTrack && g.progressPercent < 50);
  if (atRiskGoals.length > 0) {
    warnings.push({
      type: "goals_at_risk",
      message: `${atRiskGoals.length} meta(s) em risco de não serem atingidas.`,
      severity: "warning",
    });
  }

  // Calcular readiness score
  const maxIssues = 5;
  const issueCount = issues.length;
  const warningCount = warnings.length;
  const readinessScore = Math.max(0, 100 - (issueCount * 20 + warningCount * 5));

  return {
    canClose: issues.length === 0,
    issues,
    warnings,
    readinessScore,
  };
}

// ─── Status de Período ───────────────────────────────────────

/**
 * Obtém informações de bloqueio de um período.
 * Usado para validar se operações podem ser realizadas.
 */
export function getPeriodLockInfo(
  status: PeriodStatus,
  closedAt?: string,
  closedBy?: string,
  reopenedAt?: string,
  reopenedBy?: string,
): PeriodLockInfo {
  const isLocked = status === "closed";
  let lockedReason: string | undefined;

  if (isLocked) {
    lockedReason = `Período fechado em ${closedAt} por ${closedBy}. Edições bloqueadas.`;
  }

  return {
    period: { month: 0, year: 0 }, // Será preenchido pelo chamador
    status,
    isLocked,
    lockedReason,
    closedAt,
    closedBy,
    reopenedAt,
    reopenedBy,
  };
}

// ─── Auditoria de Fechamento ────────────────────────────────

export interface ClosingAuditEvent {
  type: "close" | "reopen";
  timestamp: string;
  userId: string;
  period: { month: number; year: number };
  reason?: string;
  beforeStatus?: PeriodStatus;
  afterStatus: PeriodStatus;
  snapshot?: ClosingSnapshot;
}

/**
 * Cria evento de auditoria para fechamento.
 * Será persistido em audit_logs com contexto = "Fechamento Mensal".
 */
export function createClosingAuditEvent(
  userId: string,
  month: number,
  year: number,
  snapshot: ClosingSnapshot,
): ClosingAuditEvent {
  return {
    type: "close",
    timestamp: new Date().toISOString(),
    userId,
    period: { month, year },
    afterStatus: "closed",
    snapshot,
  };
}

/**
 * Cria evento de auditoria para reabertura.
 * Será persistido em audit_logs com contexto = "Reabertura de Período".
 */
export function createReopenAuditEvent(
  userId: string,
  month: number,
  year: number,
  reason?: string,
): ClosingAuditEvent {
  return {
    type: "reopen",
    timestamp: new Date().toISOString(),
    userId,
    period: { month, year },
    reason,
    afterStatus: "open",
  };
}

// ─── Verificação de Bloqueio ────────────────────────────────

/**
 * Verifica se uma operação em um período está bloqueada.
 * Retorna true se a operação deve ser bloqueada.
 * 
 * NOTA: Esta função é DETERMINÍSTICA e reflete apenas a lógica.
 * O bloqueio real é reforçado por triggers no banco de dados.
 */
export function isOperationBlockedByClosing(
  periodStatus: PeriodStatus,
  operationType: "insert" | "update" | "delete",
): { blocked: boolean; reason?: string } {
  if (periodStatus !== "closed") {
    return { blocked: false };
  }

  const blockedOps = ["insert", "update", "delete"];
  if (blockedOps.includes(operationType)) {
    return {
      blocked: true,
      reason: `Não é possível ${operationType === "insert" ? "criar" : operationType === "update" ? "editar" : "excluir"} registros em período fechado.`,
    };
  }

  return { blocked: false };
}

// ─── Cálculo de Qualidade de Dados ──────────────────────────

export function calculateDataQuality(
  transactionsWithoutCategory: number,
  suggestedPending: number,
  incompletePending: number,
  inconsistentPending: number,
  totalTransactions: number,
): {
  overallHealth: "good" | "needs_attention" | "critical";
  score: number;
} {
  const issues =
    transactionsWithoutCategory +
    suggestedPending +
    incompletePending +
    inconsistentPending;
  const issueRatio = totalTransactions > 0 ? issues / totalTransactions : 0;

  let overallHealth: "good" | "needs_attention" | "critical";
  let score: number;

  if (inconsistentPending > 0) {
    overallHealth = "critical";
    score = Math.max(0, 100 - inconsistentPending * 30);
  } else if (issueRatio > 0.3) {
    overallHealth = "critical";
    score = Math.max(0, 100 - issues * 10);
  } else if (issueRatio > 0.15) {
    overallHealth = "needs_attention";
    score = Math.max(50, 100 - issues * 5);
  } else {
    overallHealth = "good";
    score = Math.max(70, 100 - issues * 2);
  }

  return { overallHealth, score };
}
