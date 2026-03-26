/**
 * FinanceAI — Motor de Alertas Inteligentes (Hardened)
 *
 * Gera alertas baseados em regras determinísticas sobre os dados financeiros.
 * Sprint 7 adiciona assinaturas, renovação, reajuste e cobrança suspeita.
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
  emergencyReserveConfigured?: boolean;
  emergencyReserve: number;
  monthlyExpense: number;
  emergencyReserveGoal?: number;
  subscriptionAlerts?: GeneratedAlert[];
}

export function generateAlerts(input: AlertEngineInput): GeneratedAlert[] {
  const alerts: GeneratedAlert[] = [];
  const today = new Date();

  const priorityOrder = (nivel: string) => {
    switch (nivel) {
      case "critical":
        return 0;
      case "warning":
        return 1;
      case "info":
        return 2;
      case "opportunity":
        return 3;
      default:
        return 4;
    }
  };

  const typeOrder = (tipo: string) => {
    switch (tipo) {
      case "qualidade":
        return 0;
      case "fluxo_caixa":
        return 1;
      case "orcamento_estourado":
        return 2;
      case "reserva":
        return 3;
      case "parcela_vencida":
      case "vencimento_proximo":
        return 4;
      case "reajuste":
      case "renovacao":
      case "cobranca_suspeita":
        return 5;
      case "juros_altos":
        return 6;
      default:
        return 7;
    }
  };

  for (const inst of input.installments) {
    if (inst.status === "pago") continue;
    const vencimento = new Date(inst.data_vencimento);
    const diffDays = Math.ceil((vencimento.getTime() - today.getTime()) / 86400000);

    if (diffDays >= 0 && diffDays <= 7) {
      alerts.push({
        tipo: "vencimento_proximo",
        titulo: `Parcela vence em ${diffDays === 0 ? "hoje" : `${diffDays} dia(s)`}`,
        mensagem: `${inst.emprestimo_nome || "Parcela"} de R$ ${inst.valor.toFixed(2)} vence ${
          diffDays === 0 ? "hoje" : `em ${diffDays} dia(s)`
        }.`,
        nivel: diffDays <= 2 ? "critical" : "warning",
        dados: { vencimento: inst.data_vencimento, valor: inst.valor },
      });
    }

    if (diffDays < 0) {
      alerts.push({
        tipo: "parcela_vencida",
        titulo: "Parcela em atraso",
        mensagem: `${inst.emprestimo_nome || "Parcela"} de R$ ${inst.valor.toFixed(
          2,
        )} está ${Math.abs(diffDays)} dia(s) em atraso.`,
        nivel: "critical",
        dados: {
          vencimento: inst.data_vencimento,
          valor: inst.valor,
          diasAtraso: Math.abs(diffDays),
        },
      });
    }
  }

  const exceededBudgets = input.budgetItems.filter((item) => item.status === "exceeded");
  if (exceededBudgets.length > 0) {
    if (exceededBudgets.length === 1) {
      const item = exceededBudgets[0];
      alerts.push({
        tipo: "orcamento_estourado",
        titulo: `Orçamento estourado: ${item.categoryName}`,
        mensagem: `Categoria "${item.categoryName}" ultrapassou o limite em ${item.deviationPercent.toFixed(
          0,
        )}%.`,
        nivel: "warning",
        dados: { categoria: item.categoryName, planejado: item.planned, realizado: item.actual },
      });
    } else {
      alerts.push({
        tipo: "orcamento_estourado",
        titulo: `${exceededBudgets.length} categorias com orçamento estourado`,
        mensagem: `${exceededBudgets.map((i) => i.categoryName).join(", ")} ultrapassaram seus limites.`,
        nivel: "warning",
        dados: {
          categorias: exceededBudgets.map((i) => ({ nome: i.categoryName, desvio: i.deviationPercent })),
        },
      });
    }
  }

  if (input.projectedBalance7d !== null && input.projectedBalance7d < 0) {
    alerts.push({
      tipo: "saldo_projetado_negativo",
      titulo: "Saldo projetado negativo em 7 dias",
      mensagem: `[PROJEÇÃO] O saldo pode ficar negativo em R$ ${Math.abs(
        input.projectedBalance7d,
      ).toFixed(2)} nos próximos 7 dias.`,
      nivel: "critical",
      dados: { projecao7d: input.projectedBalance7d },
    });
  } else if (input.projectedBalance30d !== null && input.projectedBalance30d < 0) {
    alerts.push({
      tipo: "saldo_projetado_negativo",
      titulo: "Saldo projetado negativo em 30 dias",
      mensagem: "[PROJEÇÃO] O saldo pode ficar negativo em 30 dias.",
      nivel: "warning",
      dados: { projecao30d: input.projectedBalance30d },
    });
  }

  if (input.suggestedCount > 0) {
    alerts.push({
      tipo: "qualidade",
      titulo: "Transações sugeridas",
      mensagem: `Você tem ${input.suggestedCount} transação(ões) sugerida(s) que ainda não entram nos cálculos oficiais.`,
      nivel: "info",
      dados: { count: input.suggestedCount },
    });
  }

  if (input.incompleteCount > 0) {
    alerts.push({
      tipo: "qualidade",
      titulo: "Transações incompletas",
      mensagem: `Há ${input.incompleteCount} transação(ões) incompletas precisando de revisão.`,
      nivel: "warning",
      dados: { count: input.incompleteCount },
    });
  }

  if (input.inconsistentCount > 0) {
    alerts.push({
      tipo: "qualidade",
      titulo: "Transações inconsistentes",
      mensagem: `Há ${input.inconsistentCount} transação(ões) inconsistentes aguardando correção manual.`,
      nivel: "critical",
      dados: { count: input.inconsistentCount },
    });
  }

  if (input.noCategoryCount > 0) {
    alerts.push({
      tipo: "qualidade",
      titulo: "Transações sem categoria",
      mensagem: `${input.noCategoryCount} transação(ões) estão sem categoria definida.`,
      nivel: "warning",
      dados: { count: input.noCategoryCount },
    });
  }

  if (input.totalIncome > 0 && input.savingsRate < 10) {
    alerts.push({
      tipo: "fluxo_caixa",
      titulo: "Taxa de economia baixa",
      mensagem: `Sua taxa de economia é de ${input.savingsRate.toFixed(1)}%. O ideal é acima de 20%.`,
      nivel: input.savingsRate < 0 ? "critical" : "warning",
      dados: { savingsRate: input.savingsRate },
    });
  }

  if (input.totalIncome > 0 && input.balance < 0) {
    alerts.push({
      tipo: "fluxo_caixa",
      titulo: "Saldo mensal negativo",
      mensagem: `Suas despesas confirmadas superam suas receitas neste mês em R$ ${Math.abs(
        input.balance,
      ).toFixed(2)}.`,
      nivel: "critical",
      dados: { balance: input.balance },
    });
  }

  if (input.emergencyReserveConfigured && input.monthlyExpense > 0) {
    const mesesReserva = input.emergencyReserve / input.monthlyExpense;
    const goal = input.emergencyReserveGoal || input.monthlyExpense * 6;
    if (input.emergencyReserve < goal) {
      alerts.push({
        tipo: "reserva",
        titulo: "Reserva abaixo da meta",
        mensagem: `Sua reserva atual (R$ ${input.emergencyReserve.toFixed(
          2,
        )}) está abaixo da meta configurada de R$ ${goal.toFixed(2)}.`,
        nivel: mesesReserva < 1 ? "critical" : "warning",
        dados: { mesesReserva, reserva: input.emergencyReserve, meta: goal },
      });
    }
  }

  for (const loan of input.loans) {
    if (loan.taxaMensal && loan.taxaMensal > 3) {
      alerts.push({
        tipo: "juros_altos",
        titulo: `Dívida com juros altos: ${loan.nome}`,
        mensagem: `"${loan.nome}" tem taxa de ${loan.taxaMensal.toFixed(
          1,
        )}% ao mês. Considere amortização extra ou priorização.`,
        nivel: "opportunity",
        dados: { nome: loan.nome, taxa: loan.taxaMensal },
      });
    }
  }

  if (input.subscriptionAlerts?.length) {
    alerts.push(...input.subscriptionAlerts);
  }

  alerts.sort((a, b) => {
    const severityDiff = priorityOrder(a.nivel) - priorityOrder(b.nivel);
    if (severityDiff !== 0) return severityDiff;
    return typeOrder(a.tipo) - typeOrder(b.tipo);
  });

  return alerts;
}
