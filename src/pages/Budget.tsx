import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
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
import { PiggyBank, Plus, Loader2, AlertTriangle, CheckCircle2, TrendingUp, Trash2 } from "lucide-react";

import { useScreenTracking } from "@/services/telemetry/useBehaviorTracking";

const STATUS_CONFIG: Record<BudgetStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  ok: { label: "No limite", className: "text-success", icon: CheckCircle2 },
  warning: { label: "Atenção", className: "text-warning", icon: AlertTriangle },
  exceeded: { label: "Estourado", className: "text-destructive", icon: AlertTriangle },
};

export default function Budget() {
  const { user } = useAuth();
  const { currentScope, scopeLabel } = useScope();
  useScreenTracking('Budget');
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
    queryKey: ["budgets", month, year, currentScope],
    queryFn: async () => {
      let query = supabase
        .from("budgets")
        .select("*, categories(nome, icone)")
        .eq("mes", month)
        .eq("ano", year);
      
      if (currentScope !== "all") {
        query = query.eq("scope", currentScope);
      }
      
      const { data } = await query;
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
    queryKey: ["budget-transactions", month, year, currentScope],
    queryFn: async () => {
      const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
      const endOfMonth = new Date(year, month, 0).toISOString().split("T")[0];
      
      let query = supabase
        .from("transactions")
        .select("id, valor, tipo, data, descricao, categoria_id, scope, data_status, source_type, confidence, e_mei, categories(nome, icone)")
        .gte("data", startOfMonth)
        .lte("data", endOfMonth);
      
      if (currentScope !== "all") {
        query = query.eq("scope", currentScope);
      }
      
      const { data } = await query;
      return (data || []).map((t: any): TransactionRaw => ({
        id: t.id, valor: Number(t.valor), tipo: t.tipo, data: t.data, descricao: t.descricao,
        categoria_id: t.categoria_id, categoria_nome: t.categories?.nome, categoria_icone: t.categories?.icone,
        scope: t.scope, data_status: t.data_status, source_type: t.source_type, confidence: t.confidence, e_mei: t.e_mei,
      }));
    },
    enabled: !!user,
  });

  // ENGINE: desvio calculado pela engine determinística
  const { data: deviation } = useQuery({
    queryKey: ["budget-deviation", budgets, transactions],
    queryFn: async () => {
      if (!budgets || !transactions) return null;
      return await calculateBudgetDeviation(budgets, transactions);
    },
    enabled: !!budgets && !!transactions,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Orçamento excluído");
    },
    onError: () => toast.error("Erro ao excluir orçamento"),
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Orçamento" description={`Planejamento de gastos mensais (${scopeLabel})`}>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Novo orçamento</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novo Orçamento</DialogTitle>
            </DialogHeader>
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

      <div className="flex gap-4 items-end">
        <div className="space-y-2">
          <Label>Mês</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }).map((_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {new Date(2024, i, 1).toLocaleString("pt-BR", { month: "long" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ano</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadingBudgets ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !budgets || budgets.length === 0 ? (
        <EmptyState icon={PiggyBank} title="Nenhum orçamento para este mês" description="Defina limites por categoria para controlar seus gastos." />
      ) : (
        <div className="grid gap-6">
          {/* Summary Card */}
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Planejado</p>
                  <p className="text-3xl font-bold font-mono">{formatCurrency(deviation?.totalPlanned || 0)}</p>
                </div>
                <div className="h-12 w-px bg-border hidden md:block" />
                <div className="text-center md:text-left">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total Realizado (Confirmado)</p>
                  <p className="text-3xl font-bold font-mono">{formatCurrency(deviation?.totalActual || 0)}</p>
                </div>
                <div className="h-12 w-px bg-border hidden md:block" />
                <div className="text-center md:text-left">
                  <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Status Geral</p>
                  {deviation && (
                    <div className={`flex items-center gap-2 text-xl font-bold ${STATUS_CONFIG[deviation.overallStatus].className}`}>
                      {(() => {
                        const Icon = STATUS_CONFIG[deviation.overallStatus].icon;
                        return <Icon className="h-6 w-6" />;
                      })()}
                      {STATUS_CONFIG[deviation.overallStatus].label}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Items */}
          <div className="grid gap-4 md:grid-cols-2">
            {deviation?.items.map((item) => (
              <Card key={item.categoryId || "none"} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{item.categoryIcon}</span>
                      <div>
                        <CardTitle className="text-base">{item.categoryName}</CardTitle>
                        <p className="text-xs text-muted-foreground">Planejado: {formatCurrency(item.planned)}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const b = budgets.find(x => x.categoria_id === item.categoryId);
                        if (b) deleteMutation.mutate(b.id);
                      }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{formatCurrency(item.actual)} realizados</span>
                    <span className={item.status === "exceeded" ? "text-destructive font-bold" : "text-muted-foreground"}>
                      {item.deviationPercent.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={Math.min(100, item.deviationPercent)} className={`h-2 ${
                    item.status === "exceeded" ? "[&>div]:bg-destructive" : item.status === "warning" ? "[&>div]:bg-warning" : ""
                  }`} />
                  {item.suggestedActual > 0 && (
                    <p className="text-[10px] text-muted-foreground italic">
                      + {formatCurrency(item.suggestedActual)} em transações sugeridas/pendentes
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BudgetForm({ categories, month, year, onSuccess }: { categories: any[]; month: number; year: number; onSuccess: () => void }) {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    categoria_id: "",
    valor_planejado: "",
    scope: currentScope === "all" ? "private" : currentScope,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    const { error } = await supabase.from("budgets").insert({
      user_id: user.id,
      categoria_id: form.categoria_id,
      valor_planejado: Number(form.valor_planejado),
      mes: month,
      ano: year,
      scope: form.scope as any,
    });
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Orçamento definido!");
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
        <Label>Valor Planejado (R$)</Label>
        <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor_planejado}
          onChange={(e) => setForm((f) => ({ ...f, valor_planejado: e.target.value }))} required />
      </div>
      <div className="space-y-2">
        <Label>Escopo</Label>
        <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "private" | "family" | "business" }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Pessoal</SelectItem>
            <SelectItem value="family">Família</SelectItem>
            <SelectItem value="business">Negócio</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Definir orçamento
      </Button>
    </form>
  );
}
