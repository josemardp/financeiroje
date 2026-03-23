/**
 * FinanceAI — Motor de Alertas Inteligentes
 * 
 * Gera alertas baseados em regras determinísticas sobre os dados financeiros.
 * Cada alerta tem tipo, severidade, mensagem e contexto estruturado.
 */

export interface GeneratedAlert {
  tipo: string;
  titulo: string;
  mensagem: string;
  nivel: "critical" | "warning" | "info" | "opportunity";
  dados: Record<string, unknown>;
}

interface AlertEngineInput {
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
    taxaMensal: number;
  }>;
  installments: Array<{
    emprestimo_nome?: string;
    valor: number;
    data_vencimento: string;
    status: string | null;
  }>;
  suggestedCount: number;
  savingsRate: number;
  projectedBalance7d: number | null;
  projectedBalance30d: number | null;
  emergencyReserve: number;
  monthlyExpense: number;
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
    // Parcelas vencidas
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
        mensagem: `Categoria "${item.categoryName}" ultrapassou o limite em ${item.deviationPercent.toFixed(0)}% (planejado: R$ ${item.planned.toFixed(2)}, realizado: R$ ${item.actual.toFixed(2)}).`,
        nivel: "warning",
        dados: { categoria: item.categoryName, planejado: item.planned, realizado: item.actual },
      });
    } else if (item.status === "warning" && item.deviationPercent > 0) {
      alerts.push({
        tipo: "orcamento_proximo_limite",
        titulo: `Categoria perto do limite: ${item.categoryName}`,
        mensagem: `"${item.categoryName}" está ${item.deviationPercent.toFixed(0)}% acima do planejado.`,
        nivel: "info",
        dados: { categoria: item.categoryName, desvio: item.deviationPercent },
      });
    }
  }

  // 3. Saldo projetado negativo
  if (input.projectedBalance7d !== null && input.projectedBalance7d < 0) {
    alerts.push({
      tipo: "saldo_projetado_negativo",
      titulo: "Saldo projetado negativo em 7 dias",
      mensagem: `[PROJEÇÃO] O saldo pode ficar negativo em R$ ${Math.abs(input.projectedBalance7d).toFixed(2)} nos próximos 7 dias, baseado nas recorrências cadastradas.`,
      nivel: "critical",
      dados: { projecao7d: input.projectedBalance7d },
    });
  } else if (input.projectedBalance30d !== null && input.projectedBalance30d < 0) {
    alerts.push({
      tipo: "saldo_projetado_negativo_30d",
      titulo: "Saldo projetado negativo em 30 dias",
      mensagem: `[PROJEÇÃO] O saldo pode ficar negativo em R$ ${Math.abs(input.projectedBalance30d).toFixed(2)} nos próximos 30 dias.`,
      nivel: "warning",
      dados: { projecao30d: input.projectedBalance30d },
    });
  }

  // 4. Suggested pendentes
  if (input.suggestedCount > 0) {
    alerts.push({
      tipo: "suggested_pendentes",
      titulo: `${input.suggestedCount} transação(ões) pendente(s)`,
      mensagem: `Existem ${input.suggestedCount} transação(ões) sugerida(s) aguardando confirmação. Confirme para incluir nos cálculos oficiais.`,
      nivel: "info",
      dados: { count: input.suggestedCount },
    });
  }

  // 5. Taxa de economia baixa
  if (input.totalIncome > 0 && input.savingsRate < 10) {
    alerts.push({
      tipo: "economia_baixa",
      titulo: "Taxa de economia baixa",
      mensagem: `Sua taxa de economia este mês é de ${input.savingsRate.toFixed(1)}%. O ideal é acima de 20%.`,
      nivel: input.savingsRate < 0 ? "critical" : "warning",
      dados: { savingsRate: input.savingsRate },
    });
  }

  // 6. Reserva de emergência insuficiente
  if (input.monthlyExpense > 0) {
    const mesesReserva = input.emergencyReserve / input.monthlyExpense;
    if (mesesReserva < 1) {
      alerts.push({
        tipo: "reserva_insuficiente",
        titulo: "Reserva de emergência insuficiente",
        mensagem: `Sua reserva cobre apenas ${mesesReserva.toFixed(1)} mês(es) de despesas. O ideal são 6 meses.`,
        nivel: mesesReserva < 0.5 ? "critical" : "warning",
        dados: { mesesReserva, reserva: input.emergencyReserve, despesaMensal: input.monthlyExpense },
      });
    }
  }

  // 7. Dívidas com juros altos
  for (const loan of input.loans) {
    if (loan.taxaMensal > 3) {
      alerts.push({
        tipo: "juros_altos",
        titulo: `Dívida com juros altos: ${loan.nome}`,
        mensagem: `"${loan.nome}" tem taxa de ${loan.taxaMensal.toFixed(1)}% ao mês. Considere amortização extra ou renegociação.`,
        nivel: "opportunity",
        dados: { nome: loan.nome, taxa: loan.taxaMensal },
      });
    }
  }

  return alerts;
}
