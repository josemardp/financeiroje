/**
 * FinanceAI — Fechamento Mensal
 * 
 * Fluxo: selecionar mês → revisar pendências → fechar opcionalmente → gerar resumo
 * Regras: mês fechado não pode ser alterado silenciosamente.
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateMonthlySummary, calculateBudgetDeviation, calculateHealthScore, filterOfficialTransactions, filterPendingTransactions } from "@/services/financeEngine";
import type { TransactionRaw, BudgetRaw } from "@/services/financeEngine/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataStatusBadge } from "@/components/shared/DataStatusBadge";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { toast } from "sonner";
import { Lock, Unlock, AlertTriangle, CheckCircle, Loader2, FileText } from "lucide-react";

export default function MonthlyClosing() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Fetch closing status
  const { data: closing } = useQuery({
    queryKey: ["monthly-closing", selectedMonth, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_closings")
        .select("*")
        .eq("mes", selectedMonth)
        .eq("ano", selectedYear)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Fetch month data
  const { data: monthData, isLoading } = useQuery({
    queryKey: ["closing-data", selectedMonth, selectedYear],
    queryFn: async () => {
      const start = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split("T")[0];
      const end = new Date(selectedYear, selectedMonth, 0).toISOString().split("T")[0];

      const [txRes, budRes] = await Promise.all([
        supabase.from("transactions").select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)").gte("data", start).lte("data", end),
        supabase.from("budgets").select("id, categoria_id, valor_planejado, mes, ano, scope, categories(nome, icone)").eq("mes", selectedMonth).eq("ano", selectedYear),
      ]);

      const rawTxns: TransactionRaw[] = (txRes.data || []).map((t: any) => ({
        id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
        categoria_id: t.categoria_id, categoria_nome: t.categories?.nome, categoria_icone: t.categories?.icone,
        scope: t.scope, data_status: t.data_status, source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
      }));

      const budgets: BudgetRaw[] = (budRes.data || []).map((b: any) => ({
        id: b.id, categoria_id: b.categoria_id, categoria_nome: b.categories?.nome, categoria_icone: b.categories?.icone,
        valor_planejado: Number(b.valor_planejado), mes: b.mes, ano: b.ano, scope: b.scope,
      }));

      const official = filterOfficialTransactions(rawTxns);
      const pending = filterPendingTransactions(rawTxns);
      const summary = official.length > 0 ? calculateMonthlySummary(official) : null;
      const budget = budgets.length > 0 ? calculateBudgetDeviation(budgets, rawTxns, selectedMonth, selectedYear) : null;

      return { rawTxns, official, pending, summary, budget, budgets };
    },
    enabled: !!user,
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!user || !monthData?.summary) throw new Error("Sem dados para fechar");

      // Build snapshots for the closing
      const budgetSnapshot = monthData.budget ? {
        items: monthData.budget.items.map(i => ({
          category: i.categoryName,
          planned: i.planned,
          actual: i.actual,
          deviation: i.deviationPercent,
          status: i.status,
        })),
        totalPlanned: monthData.budget.totalPlanned,
        totalActual: monthData.budget.totalActual,
        overallStatus: monthData.budget.overallStatus,
      } : null;

      // Calculate score snapshot
      const overdueInstallments = 0; // simplified for closing
      const scoreSnapshot = calculateHealthScore({
        totalIncome: monthData.summary.totalIncome,
        totalExpense: monthData.summary.totalExpense,
        totalDebt: 0,
        emergencyReserve: 0,
        emergencyReserveConfigured: false,
        budgetConfigured: !!monthData.budget,
        budgetDeviation: monthData.budget ? Math.max(0, monthData.budget.totalDeviationPercent) : 0,
        overdueInstallments,
        totalInstallments: 0,
        monthsWithData: 1,
        totalMonthsPossible: 1,
      });

      const pendenciasSnapshot = monthData.pending.map(t => ({
        id: t.id,
        descricao: t.descricao,
        status: t.data_status,
        valor: t.valor,
        tipo: t.tipo,
      }));

      const payload = {
        user_id: user.id,
        mes: selectedMonth,
        ano: selectedYear,
        status: "closed" as const,
        total_receitas: monthData.summary.totalIncome,
        total_despesas: monthData.summary.totalExpense,
        saldo: monthData.summary.balance,
        fechado_em: new Date().toISOString(),
        fechado_por: user.id,
        pendencias: {
          transacoes: pendenciasSnapshot,
          orcamento: budgetSnapshot,
          score: scoreSnapshot,
          qualidade: {
            semCategoria: monthData.rawTxns.filter(t => !t.categoria_id).length,
            sugeridosPendentes: monthData.pending.filter(t => t.data_status === "suggested").length,
            incompletosPendentes: monthData.pending.filter(t => t.data_status === "incomplete").length,
          },
        },
        resumo: `Mês ${formatMonthYear(selectedMonth, selectedYear)} — Receitas: ${formatCurrency(monthData.summary.totalIncome)}, Despesas: ${formatCurrency(monthData.summary.totalExpense)}, Saldo: ${formatCurrency(monthData.summary.balance)}. Score: ${scoreSnapshot.scoreGeral !== null ? scoreSnapshot.scoreGeral.toFixed(0) : 'N/A'}. ${monthData.pending.length} pendência(s).`,
      };

      if (closing) {
        const { error } = await supabase.from("monthly_closings").update(payload).eq("id", closing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("monthly_closings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-closing"] });
      toast.success("Mês fechado com sucesso");
    },
    onError: (err: any) => toast.error("Erro ao fechar mês", { description: err.message }),
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      if (!closing) throw new Error("Nada para reabrir");
      const { error } = await supabase.from("monthly_closings")
        .update({ status: "open" as const, fechado_em: null, fechado_por: null })
        .eq("id", closing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-closing"] });
      toast.success("Mês reaberto");
    },
  });

  const isClosed = closing?.status === "closed";
  const summary = monthData?.summary;
  const pending = monthData?.pending || [];
  const budget = monthData?.budget;

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Fechamento Mensal" description="Revise, consolide e feche o mês" />

      {/* Month selector */}
      <div className="flex gap-3 items-end">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Mês</span>
          <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m} value={String(m)}>{formatMonthYear(m, selectedYear).split(" ")[0]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Ano</span>
          <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Badge variant={isClosed ? "default" : "outline"} className={`h-8 ${isClosed ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" : ""}`}>
          {isClosed ? <><Lock className="h-3 w-3 mr-1" /> Fechado</> : <><Unlock className="h-3 w-3 mr-1" /> Aberto</>}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Summary KPIs */}
          {summary && (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Receitas (confirmadas)</p>
                <p className="text-xl font-bold font-mono text-[hsl(var(--success))]">{formatCurrency(summary.totalIncome)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Despesas (confirmadas)</p>
                <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(summary.totalExpense)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase">Saldo</p>
                <p className={`text-xl font-bold font-mono ${summary.balance >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>{formatCurrency(summary.balance)}</p>
              </CardContent></Card>
            </div>
          )}

          {/* Pending items */}
          {pending.length > 0 && (
            <Card className="border-[hsl(var(--warning)/0.5)]">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                  <CardTitle className="text-base">Pendências ({pending.length})</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Estas transações NÃO estão incluídas nos valores acima. Confirme ou remova antes de fechar.
                </p>
                <div className="space-y-2">
                  {pending.slice(0, 10).map(t => (
                    <div key={t.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                      <div className="flex items-center gap-2">
                        <DataStatusBadge status={t.data_status || "suggested"} />
                        <span className="truncate">{t.descricao || "Sem descrição"}</span>
                      </div>
                      <span className={`font-mono ${t.tipo === "income" ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                        {t.tipo === "income" ? "+" : "-"}{formatCurrency(t.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Budget summary */}
          {budget && budget.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Orçamento do Mês</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {budget.items.map(item => (
                    <div key={item.categoryId || "none"} className="flex items-center justify-between text-sm">
                      <span>{item.categoryIcon} {item.categoryName}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-mono">{formatCurrency(item.actual)} / {formatCurrency(item.planned)}</span>
                        <Badge variant="outline" className={`text-[10px] ${
                          item.status === "exceeded" ? "text-destructive border-destructive" :
                          item.status === "warning" ? "text-[hsl(var(--warning))] border-[hsl(var(--warning))]" :
                          "text-[hsl(var(--success))] border-[hsl(var(--success))]"
                        }`}>
                          {item.deviationPercent > 0 ? `+${item.deviationPercent.toFixed(0)}%` : `${item.deviationPercent.toFixed(0)}%`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Closing summary if already closed */}
          {closing?.resumo && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <CardTitle className="text-base">Resumo do Fechamento</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{closing.resumo}</p>
                {closing.fechado_em && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Fechado em: {new Date(closing.fechado_em).toLocaleString("pt-BR")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!isClosed ? (
              <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending || !summary}>
                {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                Fechar mês
              </Button>
            ) : (
              <Button variant="outline" onClick={() => reopenMutation.mutate()} disabled={reopenMutation.isPending}>
                {reopenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Unlock className="h-4 w-4 mr-1" />}
                Reabrir mês
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
