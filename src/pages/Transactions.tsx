import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataStatusBadge } from "@/components/shared/DataStatusBadge";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Plus, ArrowLeftRight, Search, Trash2, Pencil, Loader2 } from "lucide-react";

export default function Transactions() {
  const { user } = useAuth();
  const { currentScope, scopeLabel } = useScope();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("nome");
      return data || [];
    },
  });

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", filterType, currentScope, search, filterStatus],
    queryFn: async () => {
      let query = supabase.from("transactions").select("*, categories(nome, icone, cor)").order("data", { ascending: false }).limit(100);
      if (filterType !== "all") query = query.eq("tipo", filterType as "income" | "expense");
      if (currentScope !== "all") query = query.eq("scope", currentScope);
      if (filterStatus !== "all") query = query.eq("data_status", filterStatus as any);
      if (search) query = query.ilike("descricao", `%${search}%`);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-account-balances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
      toast.success("Transação excluída");
    },
    onError: () => toast.error("Erro ao excluir transação"),
  });

  const validateMinimumFields = (transaction: any): boolean => !!transaction.valor && Number(transaction.valor) > 0 && !!transaction.tipo && !!transaction.data;

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const txn = transactions?.find((t: any) => t.id === id);
      if (!validateMinimumFields(txn)) throw new Error("Campos obrigatórios faltando: valor, tipo e data");
      const { error } = await supabase.from("transactions").update({ data_status: "confirmed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-account-balances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
      toast.success("Transação confirmada");
    },
    onError: (err: any) => toast.error("Erro ao confirmar", { description: err.message }),
  });

  const markIncompleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").update({ data_status: "incomplete" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Marcada como incompleta");
    },
  });

  const markInconsistentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").update({ data_status: "inconsistent" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Marcada como inconsistente");
    },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Transações" description={`Histórico de lançamentos (${scopeLabel})`}>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full gap-2 sm:w-auto"><Plus className="h-4 w-4" /> Nova transação</Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-[425px]">
            <DialogHeader><DialogTitle>Nova Transação</DialogTitle></DialogHeader>
            <NewTransactionForm categories={categories || []} onSuccess={() => {
              setIsOpen(false);
              queryClient.invalidateQueries({ queryKey: ["transactions"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-account-balances"] });
              queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
            }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por descrição..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="confirmed">Confirmadas</SelectItem>
            <SelectItem value="suggested">Sugeridas</SelectItem>
            <SelectItem value="incomplete">Incompletas</SelectItem>
            <SelectItem value="inconsistent">Inconsistentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : !transactions || transactions.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="Nenhuma transação encontrada" description="Tente ajustar os filtros ou adicione uma nova transação." />
      ) : (
        <>
          {editingId && (
            <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-[425px]">
                <DialogHeader><DialogTitle>Editar Transação</DialogTitle></DialogHeader>
                <EditTransactionForm transaction={transactions.find((t: any) => t.id === editingId)} categories={categories || []} onSuccess={() => {
                  setEditingId(null);
                  queryClient.invalidateQueries({ queryKey: ["transactions"] });
                  queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
                  queryClient.invalidateQueries({ queryKey: ["dashboard-account-balances"] });
                  queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
                }} />
              </DialogContent>
            </Dialog>
          )}
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {transactions.map((t: any) => (
                  <div key={t.id} className={`flex flex-col gap-3 p-3 transition-colors sm:flex-row sm:items-center sm:justify-between sm:p-4 ${t.data_status === "confirmed" ? "hover:bg-muted/30" : "bg-yellow-50/50 hover:bg-yellow-100/50 dark:bg-yellow-950/10 dark:hover:bg-yellow-950/20"}`}>
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="shrink-0 text-xl">{t.categories?.icone || "📋"}</span>
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-medium leading-tight">{t.descricao || t.categories?.nome || "Sem descrição"}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">{formatDate(t.data)}</span>
                          <DataStatusBadge status={t.data_status} showLabel={true} />
                          <ScopeBadge scope={t.scope} />
                          {t.source_type && <Badge variant="outline" className="h-4 border-muted-foreground/20 py-0 text-[10px] uppercase text-muted-foreground">{t.source_type === "free_text" ? "Texto" : t.source_type === "voice" ? "Voz" : t.source_type === "photo_ocr" ? "OCR" : t.source_type}</Badge>}
                          {t.confidence && t.data_status !== "confirmed" && <span className={`text-[10px] font-bold ${t.confidence === "alta" ? "text-success" : t.confidence === "media" ? "text-warning" : "text-destructive"}`}>IA: {t.confidence}</span>}
                          {t.data_status !== "confirmed" && <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Não entra nos cálculos</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                      <span className={`text-base font-mono font-bold sm:text-sm ${t.tipo === "income" ? "text-success" : "text-destructive"}`}>{t.tipo === "income" ? "+" : "-"}{formatCurrency(Number(t.valor))}</span>
                      <div className="flex flex-wrap items-center gap-1 sm:justify-end sm:gap-2">
                        {t.data_status === "confirmed" && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingId(t.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>}
                        {t.data_status === "suggested" && <><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingId(t.id)} title="Editar"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-success" onClick={() => confirmMutation.mutate(t.id)} title="Confirmar" disabled={!validateMinimumFields(t)}>✓</Button><Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-amber-600" onClick={() => markIncompleteMutation.mutate(t.id)} title="Marcar como incompleta">?</Button><Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-red-600" onClick={() => markInconsistentMutation.mutate(t.id)} title="Marcar como inconsistente">!</Button></>}
                        {t.data_status === "incomplete" && <><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingId(t.id)} title="Completar"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-success" onClick={() => confirmMutation.mutate(t.id)} title="Confirmar" disabled={!validateMinimumFields(t)}>✓</Button><Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-red-600" onClick={() => markInconsistentMutation.mutate(t.id)} title="Marcar como inconsistente">!</Button></>}
                        {t.data_status === "inconsistent" && <><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setEditingId(t.id)} title="Corrigir"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-success" onClick={() => confirmMutation.mutate(t.id)} title="Confirmar" disabled={!validateMinimumFields(t)}>✓</Button></>}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function NewTransactionForm({ categories, onSuccess }: { categories: any[]; onSuccess: () => void }) {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ valor: "", tipo: "expense", categoria_id: "", descricao: "", data: new Date().toISOString().split("T")[0], scope: currentScope === "all" ? "private" : currentScope });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    const { error } = await supabase.from("transactions").insert({ user_id: user.id, valor: Number(form.valor), tipo: form.tipo as any, categoria_id: form.categoria_id || null, descricao: form.descricao, data: form.data, scope: form.scope as any, data_status: "confirmed" });
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else { toast.success("Transação salva!"); onSuccess(); }
    setIsSubmitting(false);
  };

  return <form onSubmit={handleSubmit} className="space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} required /></div><div className="space-y-2"><Label>Tipo</Label><Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Despesa</SelectItem><SelectItem value="income">Receita</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Categoria</Label><Select value={form.categoria_id} onValueChange={(v) => setForm((f) => ({ ...f, categoria_id: v }))}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Descrição</Label><Textarea placeholder="Ex: Mercado, Salário PM, Netflix..." value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={2} /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></div><div className="space-y-2"><Label>Escopo</Label><Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "private" | "family" | "business" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Pessoal</SelectItem><SelectItem value="family">Família</SelectItem><SelectItem value="business">Negócio</SelectItem></SelectContent></Select></div></div><Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar transação</Button></form>;
}

function EditTransactionForm({ transaction, categories, onSuccess }: { transaction: any; categories: any[]; onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ valor: transaction?.valor || "", tipo: transaction?.tipo || "expense", categoria_id: transaction?.categoria_id || "", descricao: transaction?.descricao || "", data: transaction?.data || new Date().toISOString().split("T")[0], scope: transaction?.scope || "private" });
  const validateMinimumFields = (): boolean => !!form.valor && Number(form.valor) > 0 && !!form.tipo && !!form.data;
  const handleSubmit = async (e: React.FormEvent, confirmAfter: boolean = false) => {
    e.preventDefault();
    if (!user || !validateMinimumFields()) { toast.error("Preencha os campos obrigatórios: valor, tipo e data"); return; }
    setIsSubmitting(true);
    const updateData: any = { valor: Number(form.valor), tipo: form.tipo as any, categoria_id: form.categoria_id || null, descricao: form.descricao, data: form.data, scope: form.scope as any };
    if (confirmAfter) updateData.data_status = "confirmed";
    const { error } = await supabase.from("transactions").update(updateData).eq("id", transaction.id);
    if (error) toast.error("Erro ao atualizar", { description: error.message });
    else { toast.success(confirmAfter ? "Transação atualizada e confirmada!" : "Transação atualizada!"); onSuccess(); }
    setIsSubmitting(false);
  };

  return <form onSubmit={handleSubmit} className="space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} required /></div><div className="space-y-2"><Label>Tipo</Label><Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">Despesa</SelectItem><SelectItem value="income">Receita</SelectItem></SelectContent></Select></div></div><div className="space-y-2"><Label>Categoria</Label><Select value={form.categoria_id} onValueChange={(v) => setForm((f) => ({ ...f, categoria_id: v }))}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Descrição</Label><Textarea placeholder="Ex: Mercado, Salário PM, Netflix..." value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={2} /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></div><div className="space-y-2"><Label>Escopo</Label><Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "private" | "family" | "business" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Pessoal</SelectItem><SelectItem value="family">Família</SelectItem><SelectItem value="business">Negócio</SelectItem></SelectContent></Select></div></div><div className="flex flex-col gap-2 sm:flex-row"><Button type="button" variant="outline" className="flex-1" onClick={(e) => handleSubmit(e as any, true)} disabled={isSubmitting}>Salvar e Confirmar</Button><Button type="submit" className="flex-1" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Apenas Salvar</Button></div></form>;
}
