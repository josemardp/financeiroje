import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateHealthScore, calculateBudgetDeviation, calculateLoanIndicators, filterOfficialTransactions } from "@/services/financeEngine";
import type { TransactionRaw, BudgetRaw, LoanRaw, InstallmentRaw, ExtraAmortizationRaw, HealthScoreResult } from "@/services/financeEngine/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, BarChart3, Info, AlertTriangle, CheckCircle } from "lucide-react";

export default function HealthScore() {
  const { user } = useAuth();

  const { data: scoreResult, isLoading } = useQuery({
    queryKey: ["health-score"],
    queryFn: async () => {
      const now = new Date();
      const mes = now.getMonth() + 1;
      const ano = now.getFullYear();
      const start = new Date(ano, mes - 1, 1).toISOString().split("T")[0];
      const end = new Date(ano, mes, 0).toISOString().split("T")[0];

      const [txRes, budRes, loanRes, instRes, amortRes] = await Promise.all([
        supabase.from("transactions").select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id").gte("data", start).lte("data", end),
        supabase.from("budgets").select("id, categoria_id, valor_planejado, mes, ano, scope").eq("mes", mes).eq("ano", ano),
        supabase.from("loans").select("*").eq("ativo", true),
        supabase.from("loan_installments").select("*"),
        supabase.from("extra_amortizations").select("*"),
      ]);

      const rawTxns: TransactionRaw[] = (txRes.data || []).map((t: any) => ({
        id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
        categoria_id: t.categoria_id, scope: t.scope, data_status: t.data_status,
        source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
      }));

      const budgets: BudgetRaw[] = (budRes.data || []).map((b: any) => ({
        id: b.id, categoria_id: b.categoria_id, valor_planejado: Number(b.valor_planejado), mes: b.mes, ano: b.ano, scope: b.scope,
      }));

      const official = filterOfficialTransactions(rawTxns);
      const totalIncome = official.filter(t => t.tipo === "income").reduce((s, t) => s + t.valor, 0);
      const totalExpense = official.filter(t => t.tipo === "expense").reduce((s, t) => s + t.valor, 0);

      const loans: LoanRaw[] = (loanRes.data || []).map((l: any) => ({
        id: l.id, nome: l.nome, valor_original: Number(l.valor_original),
        saldo_devedor: l.saldo_devedor ? Number(l.saldo_devedor) : null,
        taxa_juros_mensal: l.taxa_juros_mensal ? Number(l.taxa_juros_mensal) : null,
        cet_anual: l.cet_anual ? Number(l.cet_anual) : null,
        parcelas_total: l.parcelas_total, parcelas_restantes: l.parcelas_restantes,
        valor_parcela: l.valor_parcela ? Number(l.valor_parcela) : null,
        metodo_amortizacao: l.metodo_amortizacao, tipo: l.tipo,
        credor: l.credor, data_inicio: l.data_inicio, ativo: l.ativo,
      }));

      const installments: InstallmentRaw[] = (instRes.data || []).map((i: any) => ({
        id: i.id, emprestimo_id: i.emprestimo_id, numero: i.numero,
        valor: Number(i.valor), data_vencimento: i.data_vencimento,
        data_pagamento: i.data_pagamento, status: i.status,
      }));

      const amortizations: ExtraAmortizationRaw[] = (amortRes.data || []).map((a: any) => ({
        id: a.id, emprestimo_id: a.emprestimo_id, valor: Number(a.valor),
        data: a.data, economia_juros_calculada: a.economia_juros_calculada ? Number(a.economia_juros_calculada) : null,
      }));

      const dividas = loans.length > 0 ? calculateLoanIndicators(loans, installments, amortizations) : null;
      const orcamento = budgets.length > 0 ? calculateBudgetDeviation(budgets, rawTxns, mes, ano) : null;
      const hasBudget = budgets.length > 0;

      const overdueInstallments = installments.filter(
        i => i.status !== "pago" && new Date(i.data_vencimento) < now
      ).length;

      return calculateHealthScore({
        totalIncome,
        totalExpense,
        totalDebt: dividas?.totalSaldoDevedor || 0,
        emergencyReserve: 0,
        emergencyReserveConfigured: false,
        budgetConfigured: hasBudget,
        budgetDeviation: orcamento ? Math.max(0, orcamento.totalDeviationPercent) : 0,
        overdueInstallments,
        totalInstallments: installments.length,
        monthsWithData: 1,
        totalMonthsPossible: 1,
      });
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Score de Saúde Financeira" description="Calculando..." />
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  const score = scoreResult;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Score de Saúde Financeira" description="Nota calculada deterministicamente — apenas dados reais" />

      {/* Overall score */}
      <Card>
        <CardContent className="p-6 text-center">
          {score?.scoreGeral !== null && score?.scoreGeral !== undefined ? (
            <>
              <p className="text-5xl font-bold font-mono mb-2" style={{
                color: score.scoreGeral >= 70 ? "hsl(var(--success))" : score.scoreGeral >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))"
              }}>
                {score.scoreGeral.toFixed(0)}
              </p>
              <p className="text-sm text-muted-foreground">de 100 pontos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Baseado em {score.availableComponents} de {score.totalComponents} componentes com dados reais
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Info className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Dados insuficientes para calcular o score.</p>
              <p className="text-xs text-muted-foreground">Adicione transações confirmadas para ativar a análise.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Components */}
      {score && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ScoreComponent label="Comprometimento da Renda" value={score.comprometimentoRenda} />
          <ScoreComponent label="Reserva de Emergência" value={score.reservaEmergencia} />
          <ScoreComponent label="Controle Orçamentário" value={score.controleOrcamento} />
          <ScoreComponent label="Adimplência" value={score.adimplencia} />
          <ScoreComponent label="Regularidade" value={score.regularidade} />
        </div>
      )}

      {/* Recommendations */}
      {score && score.recommendations.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Recomendações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {score.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {rec.severity === "critical" ? <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" /> :
                 rec.severity === "warning" ? <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" /> :
                 rec.severity === "ok" ? <CheckCircle className="h-4 w-4 text-[hsl(var(--success))] shrink-0 mt-0.5" /> :
                 <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                <span className={rec.severity === "critical" ? "text-destructive" : "text-foreground"}>{rec.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreComponent({ label, value }: { label: string; value: number | null }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{label}</span>
          {value !== null ? (
            <Badge variant="outline" className="text-xs font-mono">
              {value.toFixed(0)}/100
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">Sem dados</Badge>
          )}
        </div>
        {value !== null ? (
          <Progress value={value} className="h-2" />
        ) : (
          <div className="h-2 bg-muted rounded-full" />
        )}
      </CardContent>
    </Card>
  );
}
