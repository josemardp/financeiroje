import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { calculateBudgetDeviation } from "@/services/financeEngine";
import type { BudgetRaw, TransactionRaw, BudgetStatus } from "@/services/financeEngine/types";
import { toast } from "sonner";
import { PiggyBank, Plus, Loader2, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";

const STATUS_CONFIG: Record<BudgetStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "No limite", className: "text-success", icon: CheckCircle2 },
  warning: { label: "Atenção", className: "text-warning", icon: AlertTriangle },
  exceeded: { label: "Estourado", className: "text-destructive", icon: AlertTriangle },
};

export default function Budget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("nome");
      return data || [];
    },
  });

  const { data: budgets, isLoading: loadingBudgets } = useQuery({
    queryKey: ["budgets", month, year],
    queryFn: async () => {
      const { data } = await supabase
        .from("budgets")
        .select("*, categories(nome, icone)")
        .eq("mes", month)
        .eq("ano", year);
      return (data || []).map((b: any): BudgetRaw => ({
        id: b.id,
        categoria_id: b.categoria_id,
        categoria_nome: b.categories?.nome || "Sem categoria",
        categoria_icone: b.categories?.icone || "📋",
        valor_planejado: Number(b.valor_planejado),
        mes: b.mes,
        ano: b.ano,
        scope: b.scope,
      }));
    },
    enabled: !!user,
  });

  const { data: transactions } = useQuery({
    queryKey: ["budget-transactions", month, year],
    queryFn: async () => {
      const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];
      const { data } = await supabase
        .from("transactions")
        .select("id, valor, tipo, data, descricao, categoria_id, scope, data_status, source_type, confidence, e_mei, categories(nome, icone)")
        .gte("data", startOfMonth)
        .lte("data", endOfMonth);
      return (data || []).map((t: any): TransactionRaw => ({
        id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
        categoria_id: t.categoria_id, categoria_nome: t.categories?.nome, categoria_icone: t.categories?.icone,
        scope: t.scope, data_status: t.data_status, source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
      }));
    },
    enabled: !!user,
  });

  // ENGINE: desvio calculado pela engine determinística
  const deviation = budgets && transactions
    ? calculateBudgetDeviation(budgets, transactions, month, year)
    : null;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento removido");
    },
  });

  const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Orçamento" description="Planejado vs realizado por categoria">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo orçamento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Orçamento por Categoria</DialogTitle></DialogHeader>
            <BudgetForm
              categories={categories || []}
              month={month}
              year={year}
              onSuccess={() => {
                setIsOpen(false);
                queryClient.invalidateQueries({ queryKey: ["budgets"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* Month selector */}
      <div className="flex gap-2 flex-wrap">
        {MONTHS.map((m, i) => (
          <Button
            key={m}
            variant={month === i + 1 ? "default" : "outline"}
            size="sm"
            onClick={() => setMonth(i + 1)}
          >
            {m}
          </Button>
        ))}
      </div>

      {/* Summary KPIs */}
      {deviation && deviation.items.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Planejado</p>
              <p className="text-xl font-bold font-mono">{formatCurrency(deviation.totalPlanned)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Realizado</p>
              <p className="text-xl font-bold font-mono">{formatCurrency(deviation.totalActual)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase">Desvio</p>
              <p className={`text-xl font-bold font-mono ${deviation.totalDeviationAbsolute > 0 ? "text-destructive" : "text-success"}`}>
                {deviation.totalDeviationAbsolute > 0 ? "+" : ""}{formatCurrency(deviation.totalDeviationAbsolute)}
                <span className="text-sm ml-1">({deviation.totalDeviationPercent.toFixed(1)}%)</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget items */}
      {loadingBudgets ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !deviation || deviation.items.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Sem orçamento para este mês"
          description="Defina limites por categoria para acompanhar o planejado vs realizado."
        >
          <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-1" /> Criar orçamento</Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {deviation.items.map((item) => {
            const config = STATUS_CONFIG[item.status];
            const StatusIcon = config.icon;
            const usagePercent = item.planned > 0 ? Math.min(100, (item.actual / item.planned) * 100) : 0;
            const budget = budgets?.find((b) => b.categoria_id === item.categoryId);

            return (
              <Card key={item.categoryId || "none"}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.categoryIcon}</span>
                      <span className="font-medium text-sm">{item.categoryName}</span>
                      <Badge variant="outline" className={`gap-1 text-xs ${config.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                    {budget && (
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
                        onClick={() => deleteMutation.mutate(budget.id)}>
                        Remover
                      </Button>
                    )}
                  </div>
                  <Progress value={usagePercent} className="h-2 mb-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Realizado: <span className="font-mono font-medium text-foreground">{formatCurrency(item.actual)}</span></span>
                    <span>Planejado: <span className="font-mono font-medium text-foreground">{formatCurrency(item.planned)}</span></span>
                  </div>
                  {item.deviationAbsolute !== 0 && (
                    <p className={`text-xs mt-1 ${item.deviationAbsolute > 0 ? "text-destructive" : "text-success"}`}>
                      Desvio: {item.deviationAbsolute > 0 ? "+" : ""}{formatCurrency(item.deviationAbsolute)} ({item.deviationPercent.toFixed(1)}%)
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BudgetForm({ categories, month, year, onSuccess }: { categories: any[]; month: number; year: number; onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ categoria_id: "", valor_planejado: "", scope: "private" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.valor_planejado || Number(form.valor_planejado) <= 0) {
      toast.error("Preencha o valor corretamente");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from("budgets").insert({
      user_id: user.id,
      categoria_id: form.categoria_id || null,
      valor_planejado: Number(form.valor_planejado),
      mes: month,
      ano: year,
      scope: form.scope as any,
    });
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Orçamento criado!");
      onSuccess();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={form.categoria_id} onValueChange={(v) => setForm((f) => ({ ...f, categoria_id: v }))}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {categories.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Valor planejado (R$)</Label>
        <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor_planejado}
          onChange={(e) => setForm((f) => ({ ...f, valor_planejado: e.target.value }))} required />
      </div>
      <div className="space-y-2">
        <Label>Escopo</Label>
        <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Pessoal</SelectItem>
            <SelectItem value="family">Família</SelectItem>
            <SelectItem value="business">Negócio/MEI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">Mês: {month}/{year}</p>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Salvar orçamento
      </Button>
    </form>
  );
}
