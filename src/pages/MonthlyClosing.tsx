/**
 * FinanceAI — Fechamento Mensal Premium
 * 
 * Fluxo: selecionar mês → resumo executivo → desvios → confiabilidade → leitura → foco → fechar
 * Regras: mês fechado não pode ser alterado silenciosamente.
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateMonthlySummary, calculateBudgetDeviation, calculateHealthScore, filterOfficialTransactions, filterPendingTransactions } from "@/services/financeEngine";
import { calculateGoalProgress } from "@/services/financeEngine/goalProgress";
import type { TransactionRaw, BudgetRaw, GoalRaw, GoalContributionRaw } from "@/services/financeEngine/types";
import { buildExecutiveSummary, buildDeviations, buildReliability, buildMonthReading, buildNextMonthFocus } from "@/services/closingAnalysis";
import type { GoalClosingInput, ReserveClosingInput } from "@/services/closingAnalysis";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DataStatusBadge } from "@/components/shared/DataStatusBadge";
import { ClosingExecutiveSummary } from "@/components/closing/ClosingExecutiveSummary";
import { ClosingDeviations } from "@/components/closing/ClosingDeviations";
import { ClosingReliability } from "@/components/closing/ClosingReliability";
import { ClosingMonthReading } from "@/components/closing/ClosingMonthReading";
import { ClosingNextFocus } from "@/components/closing/ClosingNextFocus";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { toast } from "sonner";
import { Lock, Unlock, AlertTriangle, Loader2, FileText, ChevronDown } from "lucide-react";

export default function MonthlyClosing() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [showPending, setShowPending] = useState(false);

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

      const [txRes, budRes, goalsRes, contribRes] = await Promise.all([
        supabase.from("transactions").select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)").gte("data", start).lte("data", end),
        supabase.from("budgets").select("id, categoria_id, valor_planejado, mes, ano, scope, categories(nome, icone)").eq("mes", selectedMonth).eq("ano", selectedYear),
        supabase.from("goals").select("id, nome, valor_alvo, valor_atual, prazo, prioridade, ativo").eq("ativo", true),
        supabase.from("goal_contributions").select("id, goal_id, valor, data"),
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
      const noCategoryCount = rawTxns.filter(t => !t.categoria_id).length;

      // Goal progress
      const goalsRaw: GoalRaw[] = (goalsRes.data || []).map((g: any) => ({
        id: g.id, nome: g.nome, valor_alvo: Number(g.valor_alvo),
        valor_atual: g.valor_atual != null ? Number(g.valor_atual) : null,
        prazo: g.prazo, prioridade: g.prioridade, ativo: g.ativo,
      }));
      const contribsRaw: GoalContributionRaw[] = (contribRes.data || []).map((c: any) => ({
        id: c.id, goal_id: c.goal_id, valor: Number(c.valor), data: c.data,
      }));
      const goalProgress = calculateGoalProgress(goalsRaw, contribsRaw);

      return { rawTxns, official, pending, summary, budget, budgets, noCategoryCount, goalProgress };
    },
    enabled: !!user,
  });

  // Derived analysis (pure, memoized)
  const analysis = useMemo(() => {
    if (!monthData?.summary) return null;
    const { summary, budget, pending, noCategoryCount, rawTxns } = monthData;
    const executive = buildExecutiveSummary(summary);
    const deviations = buildDeviations(summary, budget, pending.length, noCategoryCount);
    const reliability = buildReliability(rawTxns.length, pending.length, noCategoryCount);
    const reading = buildMonthReading(summary, budget, pending.length);
    const focus = buildNextMonthFocus(summary, budget, pending.length, reliability);
    return { executive, deviations, reliability, reading, focus };
  }, [monthData]);

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!user || !monthData?.summary) throw new Error("Sem dados para fechar");

      const budgetSnapshot = monthData.budget ? {
        items: monthData.budget.items.map(i => ({
          category: i.categoryName, planned: i.planned, actual: i.actual,
          deviation: i.deviationPercent, status: i.status,
        })),
        totalPlanned: monthData.budget.totalPlanned,
        totalActual: monthData.budget.totalActual,
        overallStatus: monthData.budget.overallStatus,
      } : null;

      const prefs = (profile?.preferences || {}) as any;
      const emergencyReserveValue = prefs.reserva_emergencia_valor || 0;
      const emergencyReserveConfigured = emergencyReserveValue > 0 || !!prefs.reserva_emergencia_meses_meta;
      const scoreSnapshot = calculateHealthScore({
        totalIncome: monthData.summary.totalIncome,
        totalExpense: monthData.summary.totalExpense,
        totalDebt: 0, emergencyReserve: emergencyReserveValue, emergencyReserveConfigured,
        budgetConfigured: !!monthData.budget,
        budgetDeviation: monthData.budget ? Math.max(0, monthData.budget.totalDeviationPercent) : 0,
        overdueInstallments: 0, totalInstallments: 0, monthsWithData: 1, totalMonthsPossible: 1,
      });

      const pendenciasSnapshot = monthData.pending.map(t => ({
        id: t.id, descricao: t.descricao, status: t.data_status, valor: t.valor, tipo: t.tipo,
      }));

      const payload: any = {
        user_id: user.id, mes: selectedMonth, ano: selectedYear, status: "closed" as const,
        total_receitas: monthData.summary.totalIncome,
        total_despesas: monthData.summary.totalExpense,
        saldo: monthData.summary.balance,
        fechado_em: new Date().toISOString(), fechado_por: user.id,
        pendencias: JSON.parse(JSON.stringify({
          transacoes: pendenciasSnapshot, orcamento: budgetSnapshot, score: scoreSnapshot,
          qualidade: {
            semCategoria: monthData.noCategoryCount,
            sugeridosPendentes: monthData.pending.filter(t => t.data_status === "suggested").length,
            incompletosPendentes: monthData.pending.filter(t => t.data_status === "incomplete").length,
          },
        })),
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
      <PageHeader title="Fechamento Mensal" description="Resumo executivo, análise e consolidação do mês" />

      {/* Month selector */}
      <div className="flex gap-3 items-end flex-wrap">
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
      ) : !summary ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Nenhuma transação confirmada neste mês.</p>
          </CardContent>
        </Card>
      ) : analysis && (
        <>
          {/* 1. Resumo Executivo */}
          <ClosingExecutiveSummary summary={summary} executive={analysis.executive} />

          {/* 2. Confiabilidade */}
          <ClosingReliability reliability={analysis.reliability} />

          {/* 3. Desvios */}
          <ClosingDeviations deviations={analysis.deviations} />

          {/* 4. Leitura do Mês */}
          <ClosingMonthReading reading={analysis.reading} />

          {/* 5. Pendências (colapsável) */}
          {pending.length > 0 && (
            <Card className="border-[hsl(var(--warning)/0.5)]">
              <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowPending(!showPending)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[hsl(var(--warning))]" />
                    <CardTitle className="text-base">Pendências ({pending.length})</CardTitle>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showPending ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
              {showPending && (
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    NÃO incluídas nos valores oficiais. Confirme antes de fechar.
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
                    {pending.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center">+{pending.length - 10} pendências adicionais</p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* 6. Orçamento resumido */}
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

          {/* 7. Foco do Próximo Mês */}
          <ClosingNextFocus focus={analysis.focus} />

          {/* 8. Resumo do fechamento (se já fechado) */}
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
