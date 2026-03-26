import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateAlerts } from "@/services/alertEngine";
import {
  calculateMonthlySummary,
  calculateBudgetDeviation,
  calculateCashflowForecast,
  calculateLoanIndicators,
  calculateSubscriptionSummary,
  filterOfficialTransactions,
} from "@/services/financeEngine";
import type {
  TransactionRaw,
  BudgetRaw,
  RecurringRaw,
  LoanRaw,
  InstallmentRaw,
} from "@/services/financeEngine/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bell,
  Check,
  AlertTriangle,
  Info,
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
  Target,
  Wallet,
  Landmark,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ALERT_LEVEL_LABELS } from "@/lib/constants";

export default function Alerts() {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: savedAlerts, isLoading } = useQuery({
    queryKey: ["alerts-all", user?.id, currentScope],
    queryFn: async () => {
      let query = supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(50);
      if (currentScope !== "all") query = query.eq("scope", currentScope);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: financialData } = useQuery({
    queryKey: ["alerts-financial-data", user?.id, currentScope],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
      const startOfHistory = new Date(Date.now() - 400 * 86400000).toISOString().split("T")[0];

      let txQuery = supabase
        .from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)")
        .gte("data", startOfHistory);

      let budgetQuery = supabase
        .from("budgets")
        .select("id, categoria_id, valor_planejado, mes, ano, scope, categories(nome, icone)")
        .eq("mes", now.getMonth() + 1)
        .eq("ano", now.getFullYear());

      let recurringQuery = supabase.from("recurring_transactions").select("*").eq("ativa", true);
      let loanQuery = supabase.from("loans").select("*").eq("ativo", true);
      let subscriptionsQuery = supabase.from("subscriptions").select("*");

      if (currentScope !== "all") {
        txQuery = txQuery.eq("scope", currentScope);
        budgetQuery = budgetQuery.eq("scope", currentScope);
        recurringQuery = recurringQuery.eq("scope", currentScope);
        loanQuery = loanQuery.eq("scope", currentScope);
        subscriptionsQuery = subscriptionsQuery.eq("scope", currentScope);
      }

      const [txRes, budRes, recRes, loanRes, instRes, profRes, subRes] = await Promise.all([
        txQuery,
        budgetQuery,
        recurringQuery,
        loanQuery,
        supabase.from("loan_installments").select("*"),
        supabase.from("profiles").select("preferences").eq("id", user!.id).single(),
        subscriptionsQuery,
      ]);

      const txs = txRes.data || [];
      const currentMonthTxs = txs.filter((t: any) => t.data >= startOfMonth && t.data <= endOfMonth);
      const visibleLoanIds = new Set((loanRes.data || []).map((loan: any) => loan.id));
      const installments = (instRes.data || []).filter((item: any) => visibleLoanIds.has(item.emprestimo_id));

      return {
        transactionsHistory: txs,
        transactionsMonth: currentMonthTxs,
        budgets: budRes.data || [],
        recurrings: recRes.data || [],
        loans: loanRes.data || [],
        installments,
        profile: profRes.data,
        subscriptions: subRes.data || [],
      };
    },
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("alerts").update({ lido: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts-all"] }),
  });

  const { data: generatedAlerts = [] } = useQuery({
    queryKey: ["alerts-generated", financialData],
    queryFn: async () => {
      if (!financialData) return [];
      const rawTxns: TransactionRaw[] = financialData.transactionsMonth.map((t: any) => ({
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

      const historyTxns: TransactionRaw[] = financialData.transactionsHistory.map((t: any) => ({
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

      const officialTxns = filterOfficialTransactions(rawTxns);
      const summary = officialTxns.length > 0 ? await calculateMonthlySummary(officialTxns) : null;

      const budgets: BudgetRaw[] = financialData.budgets.map((b: any) => ({
        id: b.id,
        categoria_id: b.categoria_id,
        categoria_nome: b.categories?.nome,
        categoria_icone: b.categories?.icone,
        valor_planejado: Number(b.valor_planejado),
        mes: b.mes,
        ano: b.ano,
        scope: b.scope,
      }));

      const budgetDev = budgets.length > 0 ? await calculateBudgetDeviation(budgets, rawTxns) : null;

      const recurrings: RecurringRaw[] = financialData.recurrings.map((r: any) => ({
        id: r.id,
        descricao: r.descricao,
        valor: Number(r.valor),
        tipo: r.tipo,
        frequencia: r.frequencia,
        dia_mes: r.dia_mes,
        ativa: r.ativa,
        categoria_id: r.categoria_id,
        scope: r.scope,
      }));

      const loans: LoanRaw[] = financialData.loans.map((l: any) => ({
        id: l.id,
        nome: l.nome,
        valor_original: Number(l.valor_original),
        saldo_devedor: l.saldo_devedor ? Number(l.saldo_devedor) : null,
        taxa_juros_mensal: l.taxa_juros_mensal ? Number(l.taxa_juros_mensal) : null,
        cet_anual: l.cet_anual ? Number(l.cet_anual) : null,
        parcelas_total: l.parcelas_total,
        parcelas_restantes: l.parcelas_restantes,
        valor_parcela: l.valor_parcela ? Number(l.valor_parcela) : null,
        metodo_amortizacao: l.metodo_amortizacao,
        tipo: l.tipo,
        credor: l.credor,
        data_inicio: l.data_inicio,
        ativo: l.ativo,
        scope: l.scope,
      } as any));

      const installments: InstallmentRaw[] = financialData.installments.map((i: any) => ({
        id: i.id,
        emprestimo_id: i.emprestimo_id,
        numero: i.numero,
        valor: Number(i.valor),
        data_vencimento: i.data_vencimento,
        data_pagamento: i.data_pagamento,
        status: i.status,
      }));

      const forecast = recurrings.length > 0
        ? await calculateCashflowForecast({
            currentBalance: summary?.balance || 0,
            recurringTransactions: recurrings,
            recentTransactions: officialTxns,
            upcomingInstallments: installments.filter((i) => i.status !== "pago"),
          })
        : null;

      const loanSummary = await calculateLoanIndicators(loans as any, installments as any);
      const subscriptionSummary = await calculateSubscriptionSummary({
        subscriptions: financialData.subscriptions || [],
        recurrings: financialData.recurrings || [],
        transactions: historyTxns,
      });

      const suggestedCount = rawTxns.filter((t) => t.data_status === "suggested").length;
      const incompleteCount = rawTxns.filter((t) => t.data_status === "incomplete").length;
      const inconsistentCount = rawTxns.filter((t) => t.data_status === "inconsistent").length;
      const noCategoryCount = rawTxns.filter((t) => !t.categoria_id).length;

      const loanNameMap = new Map(loans.map((l) => [l.id, l.nome]));
      const mappedInstallments = installments.map((i) => ({
        emprestimo_nome: loanNameMap.get(i.emprestimo_id),
        valor: i.valor,
        data_vencimento: i.data_vencimento,
        status: i.status,
      }));

      const prefs = (financialData.profile?.preferences || {}) as any;

      return generateAlerts({
        totalIncome: summary?.totalIncome || 0,
        totalExpense: summary?.totalExpense || 0,
        balance: summary?.balance || 0,
        budgetItems: budgetDev?.items.map((item) => ({
          categoryName: item.categoryName,
          planned: item.planned,
          actual: item.actual,
          deviationPercent: item.deviationPercent,
          status: item.status,
        })) || [],
        loans: loanSummary.loans.map((loan) => ({
          nome: loan.loanName,
          saldoDevedor: loan.saldoAtual,
          parcelasRestantes: loan.parcelasRestantes,
          taxaMensal: loan.taxaMensal,
        })),
        installments: mappedInstallments,
        suggestedCount,
        incompleteCount,
        inconsistentCount,
        noCategoryCount,
        savingsRate: summary?.savingsRate || 0,
        projectedBalance7d: forecast?.horizons[0]?.projectedBalance ?? null,
        projectedBalance30d: forecast?.horizons[1]?.projectedBalance ?? null,
        emergencyReserveConfigured: !!prefs.reserva_emergencia_valor || !!prefs.reserva_emergencia_meses_meta,
        emergencyReserve: prefs.reserva_emergencia_valor || 0,
        emergencyReserveGoal: prefs.reserva_emergencia_valor_meta || 0,
        monthlyExpense: summary?.totalExpense || 0,
        subscriptionAlerts: subscriptionSummary.alerts || [],
      });
    },
    enabled: !!financialData,
  });

  const iconForLevel = (nivel: string) => {
    switch (nivel) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "opportunity":
        return <Sparkles className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const iconForType = (tipo: string) => {
    switch (tipo) {
      case "qualidade":
        return <ShieldCheck className="h-4 w-4 text-purple-500" />;
      case "fluxo_caixa":
      case "saldo_projetado_negativo":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "orcamento_estourado":
        return <Target className="h-4 w-4 text-red-500" />;
      case "reserva":
      case "reajuste":
      case "renovacao":
      case "cobranca_suspeita":
        return <Wallet className="h-4 w-4 text-blue-500" />;
      case "vencimento_proximo":
      case "parcela_vencida":
      case "juros_altos":
        return <Landmark className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionForType = (tipo: string) => {
    switch (tipo) {
      case "qualidade":
        return { label: "Revisar", path: "/transacoes" };
      case "orcamento_estourado":
        return { label: "Ajustar", path: "/orcamento" };
      case "reserva":
        return { label: "Configurar", path: "/metas" };
      case "vencimento_proximo":
      case "parcela_vencida":
      case "juros_altos":
        return { label: "Gerenciar", path: "/dividas" };
      case "reajuste":
      case "renovacao":
      case "cobranca_suspeita":
        return { label: "Ver assinaturas", path: "/assinaturas" };
      case "fluxo_caixa":
      case "saldo_projetado_negativo":
        return { label: "Ver", path: "/" };
      default:
        return null;
    }
  };

  const unread = (savedAlerts || []).filter((alert: any) => !alert.lido);
  const read = (savedAlerts || []).filter((alert: any) => alert.lido);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Centro de Alertas" description="Alertas inteligentes baseados nos seus dados reais" />

      {generatedAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-3 w-3" /> Alertas em tempo real ({generatedAlerts.length})
          </h3>
          {generatedAlerts.map((alert: any, index: number) => {
            const action = getActionForType(alert.tipo);
            return (
              <Card
                key={`generated-${index}`}
                className="border-l-4"
                style={{
                  borderLeftColor:
                    alert.nivel === "critical"
                      ? "red"
                      : alert.nivel === "warning"
                        ? "orange"
                        : alert.nivel === "opportunity"
                          ? "#2563eb"
                          : "#94a3b8",
                }}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="mt-0.5">{iconForType(alert.tipo)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold">{alert.titulo}</p>
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                        {ALERT_LEVEL_LABELS[alert.nivel] || alert.nivel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{alert.mensagem}</p>
                    {action ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 mt-2 text-xs font-medium"
                        onClick={() => navigate(action.path)}
                      >
                        {action.label} <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {unread.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Não lidos ({unread.length})</h3>
          {unread.map((alert: any) => (
            <Card key={alert.id}>
              <CardContent className="p-4 flex items-start gap-3">
                {iconForLevel(alert.nivel)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.mensagem}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(alert.id)}>
                  <Check className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {read.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Lidos ({read.length})</h3>
          {read.slice(0, 10).map((alert: any) => (
            <Card key={alert.id} className="opacity-60">
              <CardContent className="p-4 flex items-start gap-3">
                {iconForLevel(alert.nivel)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.mensagem}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : null}

      {!isLoading && generatedAlerts.length === 0 && unread.length === 0 && read.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhum alerta no momento</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre transações, assinaturas, recorrências e dívidas para receber alertas úteis.</p>
        </div>
      )}
    </div>
  );
}
