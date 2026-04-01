import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { CalendarDays, Plus, Loader2, Trash2, Pencil, Pause, Play } from "lucide-react";

const FREQ_LABELS: Record<string, string> = {
  daily: "Diária", weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", yearly: "Anual",
};

export default function Recurring() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("nome");
      return data || [];
    },
  });

  const { data: recurrences, isLoading } = useQuery({
    queryKey: ["recurring"],
    queryFn: async () => {
      const { data } = await supabase.from("recurring_transactions").select("*, categories(nome, icone)").order("descricao");
      return data || [];
    },
    enabled: !!user,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase.from("recurring_transactions").update({ ativa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      toast.success("Status atualizado");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      toast.success("Recorrência excluída");
    },
  });

  const activeRecurrences = (recurrences || []).filter((r: any) => r.ativa !== false);
  const inactiveRecurrences = (recurrences || []).filter((r: any) => r.ativa === false);
  const totalReceitasMensais = activeRecurrences.filter((r: any) => r.tipo === "income" && (r.frequencia === "monthly" || !r.frequencia)).reduce((s: number, r: any) => s + Number(r.valor), 0);
  const totalDespesasMensais = activeRecurrences.filter((r: any) => r.tipo === "expense" && (r.frequencia === "monthly" || !r.frequencia)).reduce((s: number, r: any) => s + Number(r.valor), 0);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Recorrências" description="Receitas e despesas fixas mensais">
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) setEditItem(null); }}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" /> Nova recorrência</Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
            <DialogHeader><DialogTitle>{editItem ? "Editar Recorrência" : "Nova Recorrência"}</DialogTitle></DialogHeader>
            <RecurringForm categories={categories || []} editData={editItem} onSuccess={() => { setIsOpen(false); setEditItem(null); queryClient.invalidateQueries({ queryKey: ["recurring"] }); }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {activeRecurrences.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4 text-center"><p className="text-xs uppercase text-muted-foreground">Receitas fixas/mês</p><p className="text-xl font-mono font-bold text-success">{formatCurrency(totalReceitasMensais)}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-xs uppercase text-muted-foreground">Despesas fixas/mês</p><p className="text-xl font-mono font-bold text-destructive">{formatCurrency(totalDespesasMensais)}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-xs uppercase text-muted-foreground">Saldo fixo/mês</p><p className={`text-xl font-mono font-bold ${totalReceitasMensais - totalDespesasMensais >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(totalReceitasMensais - totalDespesasMensais)}</p></CardContent></Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !recurrences || recurrences.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sem recorrências" description="Cadastre salários, contas fixas e parcelas para alimentar a previsão de caixa."><Button onClick={() => setIsOpen(true)}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button></EmptyState>
      ) : (
        <>
          {activeRecurrences.length > 0 && <div><h3 className="mb-3 text-sm font-medium text-muted-foreground">Ativas ({activeRecurrences.length})</h3><Card><CardContent className="divide-y divide-border p-0">{activeRecurrences.map((r: any) => <RecurringItem key={r.id} item={r} onEdit={() => { setEditItem(r); setIsOpen(true); }} onToggle={() => toggleMutation.mutate({ id: r.id, ativa: false })} onDelete={() => deleteMutation.mutate(r.id)} />)}</CardContent></Card></div>}
          {inactiveRecurrences.length > 0 && <div><h3 className="mb-3 text-sm font-medium text-muted-foreground">Inativas ({inactiveRecurrences.length})</h3><Card><CardContent className="divide-y divide-border p-0 opacity-60">{inactiveRecurrences.map((r: any) => <RecurringItem key={r.id} item={r} onEdit={() => { setEditItem(r); setIsOpen(true); }} onToggle={() => toggleMutation.mutate({ id: r.id, ativa: true })} onDelete={() => deleteMutation.mutate(r.id)} />)}</CardContent></Card></div>}
        </>
      )}
    </div>
  );
}

function RecurringItem({ item, onEdit, onToggle, onDelete }: { item: any; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="shrink-0 text-xl">{item.categories?.icone || "📋"}</span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium leading-tight">{item.descricao}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">{FREQ_LABELS[item.frequencia] || "Mensal"}</Badge>
            {item.dia_mes && <span className="text-xs text-muted-foreground">Dia {item.dia_mes}</span>}
            <ScopeBadge scope={item.scope} />
          </div>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
        <span className={`text-base font-mono font-bold sm:text-sm ${item.tipo === "income" ? "text-success" : "text-destructive"}`}>{item.tipo === "income" ? "+" : "-"}{formatCurrency(Number(item.valor))}</span>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>{item.ativa !== false ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

function RecurringForm({ categories, editData, onSuccess }: { categories: any[]; editData?: any; onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ descricao: editData?.descricao || "", valor: editData?.valor?.toString() || "", tipo: editData?.tipo || "expense", categoria_id: editData?.categoria_id || "", frequencia: editData?.frequencia || "monthly", dia_mes: editData?.dia_mes?.toString() || "", scope: editData?.scope || "private", responsavel: editData?.responsavel || "", e_mei: editData?.e_mei || false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.descricao || !form.valor || Number(form.valor) <= 0) { toast.error("Preencha todos os campos obrigatórios"); return; }
    setIsSubmitting(true);
    const payload = { user_id: user.id, descricao: form.descricao, valor: Number(form.valor), tipo: form.tipo as any, categoria_id: form.categoria_id || null, frequencia: form.frequencia as any, dia_mes: form.dia_mes ? Number(form.dia_mes) : null, scope: form.scope as any, responsavel: form.responsavel || null, e_mei: form.e_mei };
    const { error } = editData ? await supabase.from("recurring_transactions").update(payload).eq("id", editData.id) : await supabase.from("recurring_transactions").insert(payload);
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else { toast.success(editData ? "Recorrência atualizada!" : "Recorrência criada!"); onSuccess(); }
    setIsSubmitting(false);
  };

  return <form onSubmit={handleSubmit} className="space-y-4"><div className="space-y-2"><Label>Descrição *</Label><Input placeholder="Ex: Salário, Aluguel, Netflix..." value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} required /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Valor (R$) *</Label><Input type="number" step="0.01" min="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} required /></div><div className="space-y-2"><Label>Tipo</Label><Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Despesa</SelectItem><SelectItem value="income">Receita</SelectItem></SelectContent></Select></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Frequência</Label><Select value={form.frequencia} onValueChange={(v) => setForm((f) => ({ ...f, frequencia: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Dia do mês</Label><Input type="number" min="1" max="31" placeholder="1-31" value={form.dia_mes} onChange={(e) => setForm((f) => ({ ...f, dia_mes: e.target.value }))} /></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Categoria</Label><Select value={form.categoria_id} onValueChange={(v) => setForm((f) => ({ ...f, categoria_id: v }))}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Escopo</Label><Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "private" | "family" | "business" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Pessoal</SelectItem><SelectItem value="family">Família</SelectItem><SelectItem value="business">Negócio/MEI</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Responsável</Label><Input placeholder="Ex: Josemar, Esdra..." value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} /></div><Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editData ? "Atualizar" : "Salvar recorrência"}</Button></form>;
}
