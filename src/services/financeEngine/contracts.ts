/**
 * FinanceAI — Contratos de Saída Padronizados
 * Definem a estrutura de dados que cada módulo deve retornar.
 * Garante consistência entre frontend, backend e Edge Functions.
 */

import type {
  MonthlySummary,
  BudgetDeviationResult,
  HealthScoreResult,
  CashflowForecastResult,
  GoalProgressResult,
  LoanSummary,
} from "./types";

/**
 * Metadados de rastreabilidade obrigatórios para qualquer dado financeiro.
 */
export interface DataMetadata {
  /**
   * Origem do dado: manual, voice, photo_ocr, free_text, sms, ai_suggestion, system_generated
   */
  source: "manual" | "voice" | "photo_ocr" | "free_text" | "sms" | "ai_suggestion" | "system_generated" | null;

  /**
   * Nível de confiança: alta, media, baixa
   */
  confidence: "alta" | "media" | "baixa" | null;

  /**
   * Estado do dado: confirmed, suggested, incomplete, inconsistent, missing, estimated
   */
  status: "confirmed" | "suggested" | "incomplete" | "inconsistent" | "missing" | "estimated";

  /**
   * Timestamp de quando o dado foi criado
   */
  createdAt: string;

  /**
   * Timestamp de quando o dado foi atualizado pela última vez
   */
  updatedAt: string;

  /**
   * ID do usuário que criou o dado (quando aplicável)
   */
  createdBy?: string;

  /**
   * ID do usuário que atualizou o dado pela última vez (quando aplicável)
   */
  updatedBy?: string;
}

/**
 * Relatório mensal consolidado de transações.
 * Contém resumo oficial (confirmadas) e sugeridas (pendentes).
 */
export interface MonthlyReport {
  period: {
    month: number;
    year: number;
  };

  scope: "private" | "family" | "business" | "all";

  /**
   * Resumo oficial (apenas transações confirmadas)
   */
  official: MonthlySummary | null;

  /**
   * Resumo de transações sugeridas/pendentes
   */
  pending: {
    count: number;
    totalValue: number;
    byStatus: Record<string, number>;
  };

  /**
   * Qualidade dos dados do período
   */
  dataQuality: {
    transactionsWithoutCategory: number;
    suggestedPending: number;
    incompletePending: number;
    inconsistentPending: number;
    overallHealth: "good" | "needs_attention" | "critical";
  };

  metadata: DataMetadata;
}

/**
 * Relatório de saúde financeira consolidado.
 * Inclui score, componentes e recomendações.
 */
export interface HealthReport {
  period: {
    month: number;
    year: number;
  };

  scope: "private" | "family" | "business";

  /**
   * Score geral de saúde financeira (0-100)
   */
  scoreGeral: number | null;

  /**
   * Componentes do score com detalhes
   */
  components: {
    incomeCommitment: {
      score: number | null;
      label: string;
      message: string;
    };
    emergencyReserve: {
      score: number | null;
      label: string;
      message: string;
    };
    budgetControl: {
      score: number | null;
      label: string;
      message: string;
    };
    compliance: {
      score: number | null;
      label: string;
      message: string;
    };
    regularity: {
      score: number | null;
      label: string;
      message: string;
    };
  };

  /**
   * Recomendações prioritárias
   */
  recommendations: Array<{
    component: string;
    severity: "critical" | "warning" | "info" | "ok";
    message: string;
    actionUrl?: string;
  }>;

  metadata: DataMetadata;
}

/**
 * Relatório de alertas consolidado.
 * Agrupa alertas por tipo, severidade e ação recomendada.
 */
export interface AlertsReport {
  period: {
    month: number;
    year: number;
  };

  scope: "private" | "family" | "business" | "all";

  /**
   * Alertas gerados em tempo real
   */
  generated: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    severity: "critical" | "warning" | "info" | "opportunity";
    actionLabel?: string;
    actionUrl?: string;
  }>;

  /**
   * Contadores por severidade
   */
  summary: {
    critical: number;
    warning: number;
    info: number;
    opportunity: number;
  };

  /**
   * Qualidade de dados que impacta alertas
   */
  dataQualityIssues: Array<{
    type: string;
    count: number;
    severity: "critical" | "warning" | "info";
    message: string;
  }>;

  metadata: DataMetadata;
}

/**
 * Relatório de contas consolidado.
 * Inclui saldos, movimentações e análise por conta.
 */
export interface AccountsReport {
  scope: "private" | "family" | "business" | "all";

  /**
   * Saldo total consolidado
   */
  totalBalance: number;

  /**
   * Detalhamento por conta
   */
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    scope: "private" | "family" | "business" | null;
    active: boolean;
    initialBalance: number;
    currentBalance: number;
    transactionCount: number;
  }>;

  /**
   * Movimentação consolidada
   */
  movement: {
    totalIncome: number;
    totalExpense: number;
    netFlow: number;
  };

  metadata: DataMetadata;
}

/**
 * Relatório de orçamento consolidado.
 * Inclui desvios, status e análise por categoria.
 */
export interface BudgetReport {
  period: {
    month: number;
    year: number;
  };

  scope: "private" | "family" | "business" | "all";

  /**
   * Resultado do desvio orçamentário
   */
  deviation: BudgetDeviationResult;

  /**
   * Categorias com maior risco
   */
  atRiskCategories: Array<{
    name: string;
    icon: string;
    planned: number;
    actual: number;
    deviationPercent: number;
  }>;

  /**
   * Análise de tendências
   */
  trends: {
    improvingCategories: string[];
    worseningCategories: string[];
  };

  metadata: DataMetadata;
}

/**
 * Relatório de previsão de caixa consolidado.
 * Inclui projeções e cenários.
 */
export interface ForecastReport {
  period: {
    month: number;
    year: number;
  };

  scope: "private" | "family" | "business";

  /**
   * Resultado da previsão
   */
  forecast: CashflowForecastResult;

  /**
   * Cenários alternativos (otimista, pessimista)
   */
  scenarios: {
    optimistic: number;
    realistic: number;
    pessimistic: number;
  };

  /**
   * Alertas de risco
   */
  riskAlerts: Array<{
    horizon: string;
    message: string;
    severity: "critical" | "warning" | "info";
  }>;

  metadata: DataMetadata;
}

/**
 * Relatório de metas consolidado.
 * Inclui progresso, ritmo e projeções.
 */
export interface GoalsReport {
  scope: "private" | "family" | "business" | "all";

  /**
   * Progresso de cada meta
   */
  goals: GoalProgressResult[];

  /**
   * Metas em risco
   */
  atRiskGoals: Array<{
    name: string;
    progressPercent: number;
    monthsRemaining: number;
    monthlyNeeded: number | null;
  }>;

  /**
   * Metas completadas
   */
  completedGoals: Array<{
    name: string;
    completedAt: string;
  }>;

  /**
   * Estatísticas
   */
  stats: {
    totalGoals: number;
    completedGoals: number;
    onTrackGoals: number;
    atRiskGoals: number;
  };

  metadata: DataMetadata;
}

/**
 * Relatório de dívidas consolidado.
 * Inclui saldos, parcelas e análise de juros.
 */
export interface DebtsReport {
  scope: "private" | "family" | "business" | "all";

  /**
   * Resumo de dívidas
   */
  summary: LoanSummary;

  /**
   * Dívidas com maior custo
   */
  mostExpensiveLoans: Array<{
    name: string;
    currentBalance: number;
    estimatedCost: number;
    monthlyPayment: number;
  }>;

  /**
   * Análise de impacto
   */
  impact: {
    incomeCommitmentPercent: number;
    estimatedPayoffMonths: number;
    totalInterestCost: number;
  };

  metadata: DataMetadata;
}

/**
 * Relatório consolidado de fechamento mensal.
 * Snapshot de todos os dados do mês para auditoria.
 */
export interface MonthlyClosingReport {
  period: {
    month: number;
    year: number;
  };

  scope: "private" | "family" | "business" | "all";

  status: "open" | "reviewing" | "closed";

  /**
   * Snapshots de cada domínio
   */
  snapshots: {
    monthly: MonthlyReport;
    health: HealthReport;
    budget: BudgetReport;
    accounts: AccountsReport;
    goals: GoalsReport;
    debts: DebtsReport;
  };

  /**
   * Pendências identificadas
   */
  pendencies: Array<{
    type: string;
    count: number;
    severity: "critical" | "warning" | "info";
    message: string;
  }>;

  /**
   * Análise executiva
   */
  executive: {
    verdict: "positivo" | "neutro" | "pressao" | "atencao";
    verdictLabel: string;
    verdictDescription: string;
    savingsRate: number;
  };

  metadata: DataMetadata & {
    closedBy?: string;
    closedAt?: string;
  };
}
