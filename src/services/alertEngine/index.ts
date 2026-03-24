/**
 * FinanceAI — Motor de Alertas Inteligentes (Hardened)
 * 
 * Gera alertas baseados em regras determinísticas sobre os dados financeiros.
 * HARDENING: só gera alertas quando há base real suficiente.
 * Reserva de emergência só gera alerta se explicitamente configurada.
 */

export interface GeneratedAlert {
  tipo: string;
  titulo: string;
  mensagem: string;
  nivel: "critical" | "warning" | "info" | "opportunity";
  dados: Record<string, unknown>;
}

export interface AlertEngineInput {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  budgetItems: Array<{
    categoryName: string;
    planned: number;
    actual: number;
    deviationPercent: number;
    status: string;
  }>;
  loans: Array<{
    nome: string;
    saldoDevedor: number;
    parcelasRestantes: number;
    taxaMensal?: number;
  }>;
  installments: Array<{
    emprestimo_nome?: string;
    valor: number;
    data_vencimento: string;
    status: string | null;
  }>;
  suggestedCount: number;
  incompleteCount: number;
  inconsistentCount: number;
  noCategoryCount: number;
  savingsRate: number;
  projectedBalance7d: number | null;
  projectedBalance30d: number | null;
  /** Whether emergency reserve has been explicitly configured by the user */
  emergencyReserveConfigured?: boolean;
  emergencyReserve: number;
  monthlyExpense: number;
  emergencyReserveGoal?: number;
}

export function generateAlerts(input: AlertEngineInput): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = [];
  const today = new Date();

  // 1. Parcelas vencendo nos próximos 7 dias
  for (const inst of input.installments) {
    if (inst.status === "pago") continue;
    const vencimento = new Date(inst.data_vencimento);
    const diffDays = Math.ceil((vencimento.getTime() - today.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays <= 7) {
      alerts.push({
        tipo: "vencimento_proximo",
        titulo: `Parcela vence em ${diffDays === 0 ? "hoje" : `${diffDays} dia(s)`}`,
        mensagem: `${inst.emprestimo_nome || "Parcela"} de R$ ${inst.valor.toFixed(2)} vence ${diffDays === 0 ? "hoje" : `em ${diffDays} dia(s)`}.`,
        nivel: diffDays <= 2 ? "critical" : "warning",
        dados: { vencimento: inst.data_vencimento, valor: inst.valor },
      });
    }
    if (diffDays < 0) {
      alerts.push({
        tipo: "parcela_vencida",
        titulo: "Parcela em atraso",
        mensagem: `${inst.emprestimo_nome || "Parcela"} de R$ ${inst.valor.toFixed(2)} está ${Math.abs(diffDays)} dia(s) em atraso.`,
        nivel: "critical",
        dados: { vencimento: inst.data_vencimento, valor: inst.valor, diasAtraso: Math.abs(diffDays) },
      });
    }
  }

  // 2. Orçamento estourado
  for (const item of input.budgetItems) {
    if (item.status === "exceeded") {
      alerts.push({
        tipo: "orcamento_estourado",
        titulo: `Orçamento estourado: ${item.categoryName}`,
        mensagem: `Categoria "${item.categoryName}" ultrapassou o limite em ${item.deviationPercent.toFixed(0)}%.`,
        nivel: "warning",
        dados: { categoria: item.categoryName, planejado: item.planned, realizado: item.actual },
      });
    }
  }

  // 3. Saldo projetado negativo
  if (input.projectedBalance7d !== null && input.projectedBalance7d < 0) {
    alerts.push({
      tipo: "saldo_projetado_negativo",
      titulo: "Saldo projetado negativo em 7 dias",
      mensagem: `[PROJEÇÃO] O saldo pode ficar negativo em R$ ${Math.abs(input.projectedBalance7d).toFixed(2)} nos próximos 7 dias.`,
      nivel: "critical",
      dados: { projecao7d: input.projectedBalance7d },
    });
  } else if (input.projectedBalance30d !== null && input.projectedBalance30d < 0) {
    alerts.push({
      tipo: "saldo_projetado_negativo",
      titulo: "Saldo projetado negativo em 30 dias",
      mensagem: `[PROJEÇÃO] O saldo pode ficar negativo em 30 dias.`,
      nivel: "warning",
      dados: { projecao30d: input.projectedBalance30d },
    });
  }

  // 4. Qualidade de Dados: Suggested pendentes
  if (input.suggestedCount > 0) {
    alerts.push({
      tipo: "qualidade",
      titulo: "Transações sugeridas",
      mensagem: `Você tem ${input.suggestedCount} transação(ões) sugerida(s) que ainda não entram nos cálculos oficiais.`,
      nivel: "info",
      dados: { count: input.suggestedCount },
    });
  }

  // 4b. Qualidade de Dados: Incompletas
  if (input.incompleteCount > 0) {
    alerts.push({
      tipo: "qualidade",
      titulo: "Transações incompletas",
      mensagem: `Há ${input.incompleteCount} transação(ões) incompletas precisando de revisão para integridade dos relatórios.`,
      nivel: "warning",
      dados: { count: input.incompleteCount },
    });
  }

  // 4c. Qualidade de Dados: Inconsistentes
  if (input.inconsistentCount > 0) {
    alerts.push({
      tipo: "qualidade",
      titulo: "Transações inconsistentes",
      mensagem: `Há ${input.inconsistentCount} transação(ões) inconsistentes aguardando correção manual.`,
      nivel: "critical",
      dados: { count: input.inconsistentCount },
    });
  }

  // 4d. Qualidade de Dados: Sem categoria
  if (input.noCategoryCount > 0) {
    alerts.push({
      tipo: "qualidade",
      titulo: "Transações sem categoria",
      mensagem: `${input.noCategoryCount} transação(ões) estão sem categoria definida, o que afeta o controle de orçamentos.`,
      nivel: "warning",
      dados: { count: input.noCategoryCount },
    });
  }

  // 5. Taxa de economia baixa (only if income exists)
  if (input.totalIncome > 0 && input.savingsRate < 10) {
    alerts.push({
      tipo: "fluxo_caixa",
      titulo: "Taxa de economia baixa",
      mensagem: `Sua taxa de economia é de ${input.savingsRate.toFixed(1)}%. O ideal é acima de 20% para uma saúde financeira robusta.`,
      nivel: input.savingsRate < 0 ? "critical" : "warning",
      dados: { savingsRate: input.savingsRate },
    });
  }

  // 5b. Saldo líquido negativo no mês
  if (input.totalIncome > 0 && input.balance < 0) {
    alerts.push({
      tipo: "fluxo_caixa",
      titulo: "Saldo mensal negativo",
      mensagem: `Suas despesas confirmadas superam suas receitas neste mês em R$ ${Math.abs(input.balance).toFixed(2)}.`,
      nivel: "critical",
      dados: { balance: input.balance },
    });
  }

  // 6. Reserva de emergência — ONLY if explicitly configured
  if (input.emergencyReserveConfigured && input.monthlyExpense > 0) {
    const mesesReserva = input.emergencyReserve / input.monthlyExpense;
    const goal = input.emergencyReserveGoal || (input.monthlyExpense * 6);
    
    if (input.emergencyReserve < goal) {
      alerts.push({
        tipo: "reserva",
        titulo: "Reserva abaixo da meta",
        mensagem: `Sua reserva atual (R$ ${input.emergencyReserve.toFixed(2)}) está abaixo da meta configurada de R$ ${goal.toFixed(2)}.`,
        nivel: mesesReserva < 1 ? "critical" : "warning",
        dados: { mesesReserva, reserva: input.emergencyReserve, meta: goal },
      });
    }
  }

  // 7. Dívidas com juros altos
  for (const loan of input.loans) {
    if (loan.taxaMensal && loan.taxaMensal > 3) {
      alerts.push({
        tipo: "juros_altos",
        titulo: `Dívida com juros altos: ${loan.nome}`,
        mensagem: `"${loan.nome}" tem taxa de ${loan.taxaMensal.toFixed(1)}% ao mês. Considere amortização extra.`,
        nivel: "opportunity",
        dados: { nome: loan.nome, taxa: loan.taxaMensal },
      });
    }
  }

  return alerts;
}
