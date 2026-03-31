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
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, ArrowLeftRight, Search, Filter, Trash2, Pencil, Loader2, ShieldAlert, RotateCcw } from "lucide-react";

export default function Transactions() {
  const { user } = useAuth();
  const { currentScope, scopeLabel } = useScope();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<any | null>(null);
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [hardDeletingId, setHardDeletingId] = useState<string | null>(null);
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
      let query = supabase
        .from("transactions")
        .select("*, categories(nome, icone, cor)")
        .order("data", { ascending: false })
        .limit(100);

      if (filterType !== "all") query = query.eq("tipo", filterType as "income" | "expense");
      
      // Filter by global scope context
      if (currentScope !== "all") {
        query = query.eq("scope", currentScope);
      }
      
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
      queryClient.invalidateQueries({ queryKey: ["transaction-trash"] });
      toast.success("Transação movida para a lixeira");
    },
    onError: () => toast.error("Erro ao mover para a lixeira"),
  });

  const { data: trashItems, isLoading: isTrashLoading } = useQuery({
    queryKey: ["transaction-trash", isTrashOpen],
    queryFn: async () => {
      await (supabase.rpc as any)("purge_expired_deleted_transactions");
      const { data, error } = await (supabase.rpc as any)("get_transaction_trash");
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isTrashOpen,
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.rpc as any)("restore_transaction", { p_transaction_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-account-balances"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-trash"] });
      toast.success("Transação restaurada");
    },
    onError: () => toast.error("Erro ao restaurar transação"),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.rpc as any)("hard_delete_transaction", { p_transaction_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-trash"] });
      toast.success("Transação excluída definitivamente");
      setHardDeletingId(null);
    },
    onError: () => toast.error("Erro ao excluir definitivamente"),
  });

  const validateMinimumFields = (transaction: any): boolean => {
    return !!transaction.valor && Number(transaction.valor) > 0 && !!transaction.tipo && !!transaction.data;
  };

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const txn = transactions?.find((t: any) => t.id === id);
      if (!validateMinimumFields(txn)) {
        throw new Error("Campos obrigatórios faltando: valor, tipo e data");
      }
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
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Transações" description={`Histórico de lançamentos (${scopeLabel})`}>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setIsTrashOpen(true)}>
            <Trash2 className="h-4 w-4" /> Lixeira
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Nova transação</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Nova Transação</DialogTitle>
              </DialogHeader>
              <NewTransactionForm 
                categories={categories || []} 
                onSuccess={() => {
                  setIsOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["transactions"] });
                  queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
                  queryClient.invalidateQueries({ queryKey: ["dashboard-account-balances"] });
                  queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
                }} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
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
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Editar Transação</DialogTitle>
                </DialogHeader>
                <EditTransactionForm
                  transaction={transactions.find((t: any) => t.id === editingId)}
                  categories={categories || []}
                  onSuccess={() => {
                    setEditingId(null);
                    queryClient.invalidateQueries({ queryKey: ["transactions"] });
                    queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
                    queryClient.invalidateQueries({ queryKey: ["dashboard-account-balances"] });
                    queryClient.invalidateQueries({ queryKey: ["dashboard-alerts"] });
                  }}
                />
              </DialogContent>
            </Dialog>
          )}
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
              {transactions.map((t: any) => (
                <div key={t.id} className={`flex items-center justify-between p-4 transition-colors ${
                  t.data_status === "confirmed" ? "hover:bg-muted/30" : "bg-yellow-50/50 dark:bg-yellow-950/10 hover:bg-yellow-100/50 dark:hover:bg-yellow-950/20"
                }`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                    <span className="text-xl shrink-0">{t.categories?.icone || "📋"}</span>
                    <div className="min-w-0 max-w-full">
                      <p className="text-sm font-medium truncate max-w-[40ch] sm:max-w-[60ch]" title={t.descricao || t.categories?.nome || "Sem descrição"}>{t.descricao || t.categories?.nome || "Sem descrição"}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">{formatDate(t.data)}</span>
                        <DataStatusBadge status={t.data_status} showLabel={true} />
                        <ScopeBadge scope={t.scope} />
                        {t.source_type && (
                          <Badge variant="outline" className="text-[10px] py-0 h-4 border-muted-foreground/20 text-muted-foreground uppercase">
                            {t.source_type === "free_text" ? "Texto" : t.source_type === "voice" ? "Voz" : t.source_type === "photo_ocr" ? "OCR" : t.source_type}
                          </Badge>
                        )}
                        {t.confidence && t.data_status !== "confirmed" && (
                          <span className={`text-[10px] font-bold ${t.confidence === "alta" ? "text-success" : t.confidence === "media" ? "text-warning" : "text-destructive"}`}>
                            IA: {t.confidence}
                          </span>
                        )}
                        {t.data_status !== "confirmed" && (
                          <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">
                            Não entra nos cálculos
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-mono font-bold ${t.tipo === "income" ? "text-success" : "text-destructive"}`}>
                      {t.tipo === "income" ? "+" : "-"}{formatCurrency(Number(t.valor))}
                    </span>
                    {/* Status-specific actions */}
                    {t.data_status === "suggested" && (
                      <>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-success"
                          onClick={() => confirmMutation.mutate(t.id)} title="Confirmar" disabled={!validateMinimumFields(t)}>
                          ✓
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-amber-600"
                          onClick={() => markIncompleteMutation.mutate(t.id)} title="Marcar como incompleta">
                          ?
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => markInconsistentMutation.mutate(t.id)} title="Marcar como inconsistente">
                          !
                        </Button>
                      </>
                    )}
                    {t.data_status === "incomplete" && (
                      <>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-success"
                          onClick={() => confirmMutation.mutate(t.id)} title="Confirmar" disabled={!validateMinimumFields(t)}>
                          ✓
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => markInconsistentMutation.mutate(t.id)} title="Marcar como inconsistente">
                          !
                        </Button>
                      </>
                    )}
                    {t.data_status === "inconsistent" && (
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-success"
                        onClick={() => confirmMutation.mutate(t.id)} title="Confirmar" disabled={!validateMinimumFields(t)}>
                        ✓
                      </Button>
                    )}
                    {/* Edit — always visible */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => setEditingId(t.id)} title="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {/* Delete — always visible, opens confirmation */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeletingTransaction(t)} title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              </div>
            </CardContent>
          </Card>

          {/* Delete confirmation dialog — soft delete (lixeira) */}
          <AlertDialog open={!!deletingTransaction} onOpenChange={(open) => !open && setDeletingTransaction(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-muted-foreground" />
                  Mover transação para a lixeira?
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <span className="block">A transação poderá ser restaurada por até <strong>30 dias</strong>. Após esse período, será excluída automaticamente.</span>
                  {deletingTransaction && (
                    <span className="block rounded-md bg-muted p-3 text-sm font-mono">
                      {deletingTransaction.tipo === "income" ? "+" : "-"}{formatCurrency(Number(deletingTransaction.valor))}
                      {" · "}
                      {deletingTransaction.descricao || deletingTransaction.categories?.nome || "Sem descrição"}
                      {" · "}
                      {formatDate(deletingTransaction.data)}
                    </span>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (deletingTransaction) {
                      deleteMutation.mutate(deletingTransaction.id);
                      setDeletingTransaction(null);
                    }
                  }}
                >
                  Mover para lixeira
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* Trash dialog */}
      <Dialog open={isTrashOpen} onOpenChange={setIsTrashOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              Lixeira de Transações
            </DialogTitle>
          </DialogHeader>

          {isTrashLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : !trashItems || trashItems.length === 0 ? (
            <EmptyState icon={Trash2} title="Lixeira vazia" description="Nenhuma transação deletada nos últimos 30 dias." />
          ) : (
            <div className="divide-y divide-border rounded-md border">
              {trashItems.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate max-w-[30ch] sm:max-w-[40ch]" title={t.descricao || "Sem descrição"}>
                      {t.descricao || "Sem descrição"}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span className={`font-mono font-bold ${t.tipo === "income" ? "text-success" : "text-destructive"}`}>
                        {t.tipo === "income" ? "+" : "-"}{formatCurrency(Number(t.valor))}
                      </span>
                      <span>Data: {formatDate(t.data)}</span>
                      {t.deleted_at && <span>Excluído: {formatDate(t.deleted_at)}</span>}
                      {t.expires_at && <span>Expira: {formatDate(t.expires_at)}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => restoreMutation.mutate(t.id)} title="Restaurar"
                      disabled={restoreMutation.isPending}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setHardDeletingId(t.id)} title="Excluir definitivamente">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Hard delete confirmation */}
      <AlertDialog open={!!hardDeletingId} onOpenChange={(open) => !open && setHardDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Excluir transação permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação <strong>não pode ser desfeita</strong>. A transação será removida definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (hardDeletingId) hardDeleteMutation.mutate(hardDeletingId); }}
            >
              Sim, excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewTransactionForm({ categories, onSuccess }: { categories: any[]; onSuccess: () => void }) {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    valor: "",
    tipo: "expense",
    categoria_id: "",
    descricao: "",
    data: new Date().toISOString().split("T")[0],
    scope: currentScope === "all" ? "private" : currentScope,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      valor: Number(form.valor),
      tipo: form.tipo as any,
      categoria_id: form.categoria_id || null,
      descricao: form.descricao,
      data: form.data,
      scope: form.scope as any,
      data_status: "confirmed",
    });
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Transação salva!");
      onSuccess();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
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
        <Label>Descrição</Label>
        <Textarea placeholder="Ex: Mercado, Salário PM, Netflix..." value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
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
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Salvar transação
      </Button>
    </form>
  );
}

function EditTransactionForm({ transaction, categories, onSuccess }: { transaction: any; categories: any[]; onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    valor: transaction?.valor || "",
    tipo: transaction?.tipo || "expense",
    categoria_id: transaction?.categoria_id || "",
    descricao: transaction?.descricao || "",
    data: transaction?.data || new Date().toISOString().split("T")[0],
    scope: transaction?.scope || "private",
  });

  const validateMinimumFields = (): boolean => {
    return !!form.valor && Number(form.valor) > 0 && !!form.tipo && !!form.data;
  };

  const handleSubmit = async (e: React.FormEvent, confirmAfter: boolean = false) => {
    e.preventDefault();
    if (!user || !validateMinimumFields()) {
      toast.error("Preencha os campos obrigatórios: valor, tipo e data");
      return;
    }
    setIsSubmitting(true);
    const updateData: any = {
      valor: Number(form.valor),
      tipo: form.tipo as any,
      categoria_id: form.categoria_id || null,
      descricao: form.descricao,
      data: form.data,
      scope: form.scope as any,
    };
    if (confirmAfter) {
      updateData.data_status = "confirmed";
    }
    const { error } = await supabase.from("transactions").update(updateData).eq("id", transaction.id);
    if (error) {
      toast.error("Erro ao atualizar", { description: error.message });
    } else {
      toast.success(confirmAfter ? "Transação atualizada e confirmada!" : "Transação atualizada!");
      onSuccess();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
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
        <Label>Descrição</Label>
        <Textarea placeholder="Ex: Mercado, Salário PM, Netflix..." value={form.descricao}
          onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
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
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={(e) => handleSubmit(e, true)} disabled={isSubmitting}>
          Salvar e Confirmar
        </Button>
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Apenas Salvar
        </Button>
      </div>
    </form>
  );
}
