import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatMonthYear } from "@/lib/format";
import { calculateMonthlySummary, filterOfficialTransactions } from "@/services/financeEngine";
import type { TransactionRaw } from "@/services/financeEngine/types";
import { SCOPE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

export default function Reports() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [onlyOfficial, setOnlyOfficial] = useState(true);

  const { data: rawTransactions, isLoading } = useQuery({
    queryKey: ["report-transactions", month, year],
    queryFn: async () => {
      const start = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const end = new Date(year, month, 0).toISOString().split("T")[0];
      const { data } = await supabase
        .from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)")
        .gte("data", start).lte("data", end)
        .order("data", { ascending: false });
      return (data || []).map((t: any): TransactionRaw => ({
        id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
        categoria_id: t.categoria_id, categoria_nome: t.categories?.nome, categoria_icone: t.categories?.icone,
        scope: t.scope, data_status: t.data_status, source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
      }));
    },
    enabled: !!user,
  });

  const official = rawTransactions ? filterOfficialTransactions(rawTransactions) : [];

  const { data: summary } = useQuery({
    queryKey: ["report-summary", official],
    queryFn: async () => {
      if (!official || official.length === 0) return null;
      return await calculateMonthlySummary(official);
    },
    enabled: official.length > 0,
  });

  const scopeBreakdown = rawTransactions ? (() => {
    const scopes: Record<string, { income: number; expense: number }> = {};
    filterOfficialTransactions(rawTransactions).forEach((t) => {
      const s = t.scope || "private";
      if (!scopes[s]) scopes[s] = { income: 0, expense: 0 };
      if (t.tipo === "income") scopes[s].income += t.valor;
      else scopes[s].expense += t.valor;
    });
    return scopes;
  })() : {};

  const exportCSV = () => {
    if (!rawTransactions || rawTransactions.length === 0) {
      toast.error("Sem dados para exportar"); return;
    }

    const toExport = onlyOfficial ? filterOfficialTransactions(rawTransactions) : rawTransactions;
    if (toExport.length === 0) {
      toast.error("Sem dados para exportar com o filtro selecionado"); return;
    }

    const headers = ["Data", "Tipo", "Valor", "Descrição", "Categoria", "Escopo", "Status"];
    const rows = toExport.map((t) => [
      t.data, t.tipo === "income" ? "Receita" : "Despesa", t.valor.toFixed(2), t.descricao || "", t.categoria_nome || "", SCOPE_LABELS[t.scope || "private"] || "", t.data_status || "confirmed",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes_${year}_${String(month).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Relatórios" description="Resumos e exportações financeiras">
        <Button onClick={exportCSV} variant="outline" className="w-full sm:w-auto" disabled={!rawTransactions || rawTransactions.length === 0}>
          <Download className="mr-1 h-4 w-4" /> Exportar CSV
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="grid grid-cols-2 gap-3 sm:flex">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-full sm:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => <SelectItem key={m} value={String(m)}>{formatMonthYear(m, year).split(" ")[0]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-full sm:w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[now.getFullYear(), now.getFullYear() - 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <label htmlFor="onlyOfficial" className="flex items-start gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm">
          <input type="checkbox" id="onlyOfficial" checked={onlyOfficial} onChange={(e) => setOnlyOfficial(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
          <span className="leading-snug">Apenas dados confirmados no CSV</span>
        </label>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !summary ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sem dados confirmados para {formatMonthYear(month, year)}.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo Mensal — {formatMonthYear(month, year)}</CardTitle>
              <CardDescription>Dados confirmados ({summary.confirmedCount} transações)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Receitas</p><p className="text-lg font-bold text-success">{formatCurrency(summary.totalIncome)}</p></div>
                <div><p className="text-xs text-muted-foreground">Despesas</p><p className="text-lg font-bold text-destructive">{formatCurrency(summary.totalExpense)}</p></div>
                <div><p className="text-xs text-muted-foreground">Saldo</p><p className={`text-lg font-bold ${summary.balance >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(summary.balance)}</p></div>
                <div><p className="text-xs text-muted-foreground">Taxa de Economia</p><p className="text-lg font-bold">{summary.savingsRate.toFixed(1)}%</p></div>
              </div>
            </CardContent>
          </Card>

          {summary.expenseByCategory.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {summary.expenseByCategory.map((cat) => (
                    <div key={cat.categoryId || "none"} className="flex flex-col gap-1.5 border-b border-border py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <span>{cat.categoryIcon}</span>
                        <span className="min-w-0 text-sm break-words">{cat.categoryName}</span>
                        <span className="text-xs text-muted-foreground">({cat.count})</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <span className="text-sm font-mono">{formatCurrency(cat.total)}</span>
                        <span className="w-10 text-right text-xs text-muted-foreground">{cat.percentage.toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(scopeBreakdown).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Resumo por Escopo</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(scopeBreakdown).map(([scope, vals]) => (
                    <div key={scope} className="flex flex-col gap-2 border-b border-border py-1.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-medium">{SCOPE_LABELS[scope] || scope}</span>
                      <div className="flex flex-wrap gap-4 text-sm font-mono sm:justify-end sm:gap-6">
                        <span className="text-success">+{formatCurrency(vals.income)}</span>
                        <span className="text-destructive">-{formatCurrency(vals.expense)}</span>
                        <span className={vals.income - vals.expense >= 0 ? "text-success" : "text-destructive"}>{formatCurrency(vals.income - vals.expense)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
