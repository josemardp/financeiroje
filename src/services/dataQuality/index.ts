/**
 * FinanceAI — Camada de Qualidade dos Dados
 * 
 * Detecta problemas de qualidade nos dados do usuário.
 * Output estruturado consumido por: dashboard, alertas, IA, fechamento.
 */

export interface DataQualityIssue {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  entity: string; // "transaction" | "budget" | "recurring" | "goal" | "loan" | "document"
  entityId?: string;
  actionLabel?: string;
  actionRoute?: string;
}

export interface DataQualityReport {
  issues: DataQualityIssue[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  overallHealth: "good" | "needs_attention" | "critical";
}

interface QualityInput {
  transactions: Array<{
    id: string; descricao: string | null; categoria_id: string | null;
    data_status: string | null; valor: number; tipo: string; data: string;
    created_at?: string;
  }>;
  budgets: Array<{ id: string; categoria_id: string | null; mes: number; ano: number }>;
  recurringTransactions: Array<{
    id: string; descricao: string; ativa: boolean | null;
    dia_mes: number | null; frequencia: string | null;
  }>;
  goals: Array<{
    id: string; nome: string; valor_atual: number | null;
    valor_alvo: number; prazo: string | null;
  }>;
  loans: Array<{
    id: string; nome: string; saldo_devedor: number | null;
    parcelas_total: number | null; parcelas_restantes: number | null;
    taxa_juros_mensal: number | null;
  }>;
  documents: Array<{
    id: string; file_name: string;
    linked_entity_id: string | null; status_processamento: string | null;
  }>;
}

export function analyzeDataQuality(input: QualityInput): DataQualityReport {
  const issues: DataQualityIssue[] = [];
  let issueCounter = 0;
  const nextId = () => `dq-${++issueCounter}`;

  // 1. Transações sem categoria
  const semCategoria = input.transactions.filter(t => !t.categoria_id && t.data_status !== "missing");
  if (semCategoria.length > 0) {
    issues.push({
      id: nextId(), type: "missing_category", severity: "warning",
      title: `${semCategoria.length} transação(ões) sem categoria`,
      description: "Transações sem categoria dificultam a análise orçamentária e as sugestões da IA.",
      entity: "transaction", actionLabel: "Categorizar", actionRoute: "/transacoes",
    });
  }

  // 2. Transações sugeridas pendentes
  const sugeridas = input.transactions.filter(t => t.data_status === "suggested");
  if (sugeridas.length > 0) {
    issues.push({
      id: nextId(), type: "pending_suggested", severity: "warning",
      title: `${sugeridas.length} transação(ões) sugerida(s) pendente(s)`,
      description: "Transações sugeridas não entram nos cálculos oficiais até serem confirmadas.",
      entity: "transaction", actionLabel: "Revisar", actionRoute: "/transacoes",
    });
  }

  // 3. Transações incompletas
  const incompletas = input.transactions.filter(t => t.data_status === "incomplete");
  if (incompletas.length > 0) {
    issues.push({
      id: nextId(), type: "incomplete_transactions", severity: "warning",
      title: `${incompletas.length} transação(ões) incompleta(s)`,
      description: "Dados incompletos podem comprometer a precisão das análises.",
      entity: "transaction", actionLabel: "Completar", actionRoute: "/transacoes",
    });
  }

  // 4. Transações inconsistentes
  const inconsistentes = input.transactions.filter(t => t.data_status === "inconsistent");
  if (inconsistentes.length > 0) {
    issues.push({
      id: nextId(), type: "inconsistent_transactions", severity: "critical",
      title: `${inconsistentes.length} transação(ões) inconsistente(s)`,
      description: "Dados inconsistentes detectados. Revise para garantir integridade dos cálculos.",
      entity: "transaction", actionLabel: "Corrigir", actionRoute: "/transacoes",
    });
  }

  // 5. Duplicatas suspeitas (mesmo valor, mesma data, mesma descrição)
  const txnMap = new Map<string, typeof input.transactions>();
  for (const t of input.transactions) {
    const key = `${t.valor}-${t.data}-${(t.descricao || "").toLowerCase().trim()}`;
    if (!txnMap.has(key)) txnMap.set(key, []);
    txnMap.get(key)!.push(t);
  }
  const duplicates = [...txnMap.values()].filter(group => group.length > 1);
  if (duplicates.length > 0) {
    const totalDupes = duplicates.reduce((s, g) => s + g.length - 1, 0);
    issues.push({
      id: nextId(), type: "suspected_duplicates", severity: "warning",
      title: `${totalDupes} possível(is) transação(ões) duplicada(s)`,
      description: "Encontramos transações com mesmo valor, data e descrição. Verifique se não são duplicatas.",
      entity: "transaction", actionLabel: "Verificar", actionRoute: "/transacoes",
    });
  }

  // 6. Metas sem progresso recente
  const now = new Date();
  for (const goal of input.goals) {
    const progress = ((goal.valor_atual || 0) / goal.valor_alvo) * 100;
    if (goal.prazo) {
      const deadline = new Date(goal.prazo);
      const monthsLeft = (deadline.getFullYear() - now.getFullYear()) * 12 + (deadline.getMonth() - now.getMonth());
      if (monthsLeft <= 3 && progress < 50) {
        issues.push({
          id: nextId(), type: "goal_at_risk", severity: "warning",
          title: `Meta "${goal.nome}" em risco`,
          description: `Apenas ${progress.toFixed(0)}% atingido com ${monthsLeft} meses restantes.`,
          entity: "goal", entityId: goal.id,
          actionLabel: "Ver meta", actionRoute: "/metas",
        });
      }
    }
  }

  // 7. Dívidas com dados parciais
  for (const loan of input.loans) {
    const missingFields: string[] = [];
    if (loan.saldo_devedor == null) missingFields.push("saldo devedor");
    if (loan.taxa_juros_mensal == null) missingFields.push("taxa de juros");
    if (loan.parcelas_restantes == null) missingFields.push("parcelas restantes");
    if (missingFields.length >= 2) {
      issues.push({
        id: nextId(), type: "loan_incomplete", severity: "info",
        title: `Dívida "${loan.nome}" com dados incompletos`,
        description: `Campos faltantes: ${missingFields.join(", ")}. Complete para indicadores mais precisos.`,
        entity: "loan", entityId: loan.id,
        actionLabel: "Completar", actionRoute: "/dividas",
      });
    }
  }

  // 8. Documentos sem vínculo
  const docsNoLink = input.documents.filter(d => !d.linked_entity_id);
  if (docsNoLink.length > 0) {
    issues.push({
      id: nextId(), type: "unlinked_documents", severity: "info",
      title: `${docsNoLink.length} documento(s) sem vínculo`,
      description: "Documentos não vinculados a transações podem dificultar a auditoria.",
      entity: "document", actionLabel: "Vincular", actionRoute: "/documentos",
    });
  }

  const criticalCount = issues.filter(i => i.severity === "critical").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  const infoCount = issues.filter(i => i.severity === "info").length;

  return {
    issues,
    criticalCount,
    warningCount,
    infoCount,
    overallHealth: criticalCount > 0 ? "critical" : warningCount > 0 ? "needs_attention" : "good",
  };
}
