import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { analyzeDataQuality } from "@/services/dataQuality";
import { generateAlerts, type GeneratedAlert } from "@/services/alertEngine";
import { calculateMonthlySummary, calculateBudgetDeviation, calculateCashflowForecast, calculateLoanIndicators, filterOfficialTransactions } from "@/services/financeEngine";
import type { TransactionRaw, BudgetRaw, RecurringRaw, LoanRaw, InstallmentRaw, ExtraAmortizationRaw } from "@/services/financeEngine/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Check, AlertTriangle, Info, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { ALERT_LEVEL_LABELS } from "@/lib/constants";

export default function Alerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch saved alerts
  const { data: savedAlerts, isLoading } = useQuery({
    queryKey: ["alerts-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch data for generating new alerts
  const { data: financialData } = useQuery({
    queryKey: ["alerts-financial-data"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const [txRes, budRes, recRes, loanRes, instRes, amortRes] = await Promise.all([
        supabase.from("transactions").select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)").gte("data", startOfMonth).lte("data", endOfMonth),
        supabase.from("budgets").select("id, categoria_id, valor_planejado, mes, ano, scope, categories(nome, icone)").eq("mes", now.getMonth() + 1).eq("ano", now.getFullYear()),
        supabase.from("recurring_transactions").select("*").eq("ativa", true),
        supabase.from("loans").select("*").eq("ativo", true),
        supabase.from("loan_installments").select("*"),
        supabase.from("extra_amortizations").select("*"),
      ]);

      return { transactions: txRes.data || [], budgets: budRes.data || [], recurrings: recRes.data || [], loans: loanRes.data || [], installments: instRes.data || [], amortizations: amortRes.data || [] };
    },
    enabled: !!user,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("alerts").update({ lido: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts-all"] }),
  });

  // Generate alerts from current data
  const generatedAlerts: GeneratedAlert[] = (() => {
    if (!financialData) return [];
    const now = new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();

    const rawTxns: TransactionRaw[] = (financialData.transactions).map((t: any) => ({
      id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
      categoria_id: t.categoria_id, categoria_nome: t.categories?.nome, categoria_icone: t.categories?.icone,
      scope: t.scope, data_status: t.data_status, source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
    }));

    const officialTxns = filterOfficialTransactions(rawTxns);
    const summary = officialTxns.length > 0 ? calculateMonthlySummary(officialTxns) : null;

    const budgets: BudgetRaw[] = (financialData.budgets).map((b: any) => ({
      id: b.id, categoria_id: b.categoria_id, categoria_nome: b.categories?.nome, categoria_icone: b.categories?.icone,
      valor_planejado: Number(b.valor_planejado), mes: b.mes, ano: b.ano, scope: b.scope,
    }));

    const budgetDev = budgets.length > 0 ? calculateBudgetDeviation(budgets, rawTxns, mes, ano) : null;

    const recurrings: RecurringRaw[] = (financialData.recurrings).map((r: any) => ({
      id: r.id, descricao: r.descricao, valor: Number(r.valor), tipo: r.tipo,
      frequencia: r.frequencia, dia_mes: r.dia_mes, ativa: r.ativa, categoria_id: r.categoria_id, scope: r.scope,
    }));

    const loans: LoanRaw[] = (financialData.loans).map((l: any) => ({
      id: l.id, nome: l.nome, valor_original: Number(l.valor_original),
      saldo_devedor: l.saldo_devedor ? Number(l.saldo_devedor) : null,
      taxa_juros_mensal: l.taxa_juros_mensal ? Number(l.taxa_juros_mensal) : null,
      cet_anual: l.cet_anual ? Number(l.cet_anual) : null,
      parcelas_total: l.parcelas_total, parcelas_restantes: l.parcelas_restantes,
      valor_parcela: l.valor_parcela ? Number(l.valor_parcela) : null,
      metodo_amortizacao: l.metodo_amortizacao, tipo: l.tipo,
      credor: l.credor, data_inicio: l.data_inicio, ativo: l.ativo,
    }));

    const installments: InstallmentRaw[] = (financialData.installments).map((i: any) => ({
      id: i.id, emprestimo_id: i.emprestimo_id, numero: i.numero,
      valor: Number(i.valor), data_vencimento: i.data_vencimento,
      data_pagamento: i.data_pagamento, status: i.status,
    }));

    const forecast = recurrings.length > 0 ? calculateCashflowForecast({
      currentBalance: summary?.balance || 0,
      recurringTransactions: recurrings,
      recentTransactions: officialTxns,
      upcomingInstallments: installments.filter(i => i.status !== "pago"),
    }) : null;

    const loanSummary = calculateLoanIndicators(loans, installments, (financialData.amortizations).map((a: any) => ({
      id: a.id, emprestimo_id: a.emprestimo_id, valor: Number(a.valor), data: a.data,
      economia_juros_calculada: a.economia_juros_calculada ? Number(a.economia_juros_calculada) : null,
    })));

    const suggestedCount = rawTxns.filter(t => t.data_status === "suggested").length;

    // Map installments with loan names
    const loanNameMap = new Map(loans.map(l => [l.id, l.nome]));
    const mappedInstallments = installments.map(i => ({
      emprestimo_nome: loanNameMap.get(i.emprestimo_id),
      valor: i.valor,
      data_vencimento: i.data_vencimento,
      status: i.status,
    }));

    return generateAlerts({
      totalIncome: summary?.totalIncome || 0,
      totalExpense: summary?.totalExpense || 0,
      balance: summary?.balance || 0,
      budgetItems: budgetDev?.items.map(i => ({
        categoryName: i.categoryName, planned: i.planned,
        actual: i.actual, deviationPercent: i.deviationPercent, status: i.status,
      })) || [],
      loans: loanSummary.loans.map(l => ({
        nome: l.loanName, saldoDevedor: l.saldoAtual,
        parcelasRestantes: l.parcelasRestantes, taxaMensal: l.taxaMensal,
      })),
      installments: mappedInstallments,
      suggestedCount,
      savingsRate: summary?.savingsRate || 0,
      projectedBalance7d: forecast?.horizons[0]?.projectedBalance ?? null,
      projectedBalance30d: forecast?.horizons[1]?.projectedBalance ?? null,
      emergencyReserve: 0,
      monthlyExpense: summary?.totalExpense || 0,
    });
  })();

  const iconForLevel = (nivel: string) => {
    switch (nivel) {
      case "critical": return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />;
      case "opportunity": return <Sparkles className="h-4 w-4 text-[hsl(var(--info))]" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const unread = (savedAlerts || []).filter((a: any) => !a.lido);
  const read = (savedAlerts || []).filter((a: any) => a.lido);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Centro de Alertas" description="Alertas inteligentes baseados nos seus dados reais" />

      {/* Generated alerts (real-time from engine) */}
      {generatedAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <RefreshCw className="h-3 w-3" /> Alertas em tempo real ({generatedAlerts.length})
          </h3>
          {generatedAlerts.map((alert, i) => (
            <Card key={`gen-${i}`}>
              <CardContent className="p-4 flex items-start gap-3">
                {iconForLevel(alert.nivel)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{alert.titulo}</p>
                    <Badge variant="outline" className="text-[10px]">{ALERT_LEVEL_LABELS[alert.nivel] || alert.nivel}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{alert.mensagem}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Saved unread alerts */}
      {unread.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Não lidos ({unread.length})
          </h3>
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

      {/* Read alerts */}
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

      {isLoading && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}

      {!isLoading && generatedAlerts.length === 0 && unread.length === 0 && read.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhum alerta no momento</p>
          <p className="text-xs text-muted-foreground mt-1">Cadastre transações, orçamentos e dívidas para receber alertas inteligentes.</p>
        </div>
      )}
    </div>
  );
}
