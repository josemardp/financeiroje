/**
 * FinanceAI — Previsão de Caixa Visual
 * Usa a engine determinística. Não recalcula no frontend.
 */
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateCashflowForecast, filterOfficialTransactions, calculateMonthlySummary } from "@/services/financeEngine";
import type { RecurringRaw, TransactionRaw, InstallmentRaw, CashflowForecastResult } from "@/services/financeEngine/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { TrendingUp, TrendingDown, DollarSign, AlertTriangle, Info, Loader2 } from "lucide-react";

export default function Forecast() {
  const { user } = useAuth();

  const { data: forecastResult, isLoading } = useQuery({
    queryKey: ["forecast-data"],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const [txRes, recRes, instRes] = await Promise.all([
        supabase.from("transactions").select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id").gte("data", startOfMonth).lte("data", endOfMonth),
        supabase.from("recurring_transactions").select("*").eq("ativa", true),
        supabase.from("loan_installments").select("*").neq("status", "pago"),
      ]);

      const rawTxns: TransactionRaw[] = (txRes.data || []).map((t: any) => ({
        id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
        categoria_id: t.categoria_id, scope: t.scope, data_status: t.data_status,
        source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
      }));

      const officialTxns = filterOfficialTransactions(rawTxns);
      const summary = officialTxns.length > 0 ? calculateMonthlySummary(officialTxns) : null;
      const currentBalance = summary?.balance || 0;

      const recurrings: RecurringRaw[] = (recRes.data || []).map((r: any) => ({
        id: r.id, descricao: r.descricao, valor: Number(r.valor), tipo: r.tipo,
        frequencia: r.frequencia, dia_mes: r.dia_mes, ativa: r.ativa,
        categoria_id: r.categoria_id, scope: r.scope,
      }));

      const installments: InstallmentRaw[] = (instRes.data || []).map((i: any) => ({
        id: i.id, emprestimo_id: i.emprestimo_id, numero: i.numero,
        valor: Number(i.valor), data_vencimento: i.data_vencimento,
        data_pagamento: i.data_pagamento, status: i.status,
      }));

      return calculateCashflowForecast({
        currentBalance,
        recurringTransactions: recurrings,
        recentTransactions: officialTxns,
        upcomingInstallments: installments,
      });
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Previsão de Caixa" description="Carregando projeção..." />
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  const forecast = forecastResult;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Previsão de Caixa" description="Projeção baseada em recorrências e parcelas — todos os valores são [PROJEÇÃO]" />

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-[hsl(var(--status-estimated)/0.1)] rounded-lg px-4 py-2">
        <Badge variant="outline" className="data-badge-estimated text-[10px]">PROJEÇÃO</Badge>
        <span>Todos os valores abaixo são projeções baseadas nas recorrências cadastradas. Não representam dados confirmados.</span>
      </div>

      {/* Current balance */}
      <KpiCard
        title="Saldo Atual (confirmado)"
        value={formatCurrency(forecast?.currentBalance || 0)}
        icon={DollarSign}
        variant={forecast && forecast.currentBalance >= 0 ? "success" : "destructive"}
      />

      {/* Horizons */}
      <div className="grid gap-4 sm:grid-cols-3">
        {forecast?.horizons.map((h) => (
          <Card key={h.days} className={h.projectedBalance < 0 ? "border-destructive/50" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{h.label}</CardTitle>
                <Badge variant="outline" className={`text-[10px] ${
                  h.confidenceLevel === "alta" ? "data-badge-confirmed" :
                  h.confidenceLevel === "media" ? "data-badge-suggested" : "data-badge-estimated"
                }`}>
                  Confiança: {h.confidenceLevel}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Saldo projetado</p>
                <p className={`text-xl font-bold font-mono ${h.projectedBalance >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                  {formatCurrency(h.projectedBalance)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Entradas previstas</p>
                  <p className="text-sm font-mono text-[hsl(var(--success))]">+{formatCurrency(h.totalInflows)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Saídas previstas</p>
                  <p className="text-sm font-mono text-destructive">-{formatCurrency(h.totalOutflows)}</p>
                </div>
              </div>
              {h.projectedBalance < 0 && (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Saldo negativo projetado</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Assumptions */}
      {forecast && (forecast.assumptions.length > 0 || forecast.warnings.length > 0) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Premissas e Avisos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {forecast.assumptions.map((a, i) => (
              <div key={`a-${i}`} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3 w-3 shrink-0" />
                <span>{a}</span>
              </div>
            ))}
            {forecast.warnings.map((w, i) => (
              <div key={`w-${i}`} className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
