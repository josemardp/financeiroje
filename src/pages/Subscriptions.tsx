import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { calculateSubscriptionSummary } from "@/services/financeEngine";
import { formatCurrency, formatDate } from "@/lib/format";
import { Wallet, Plus, Loader2, Trash2, Pencil, ShieldAlert, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  yearly: "Anual",
  weekly: "Semanal",
  biweekly: "Quinzenal",
};

function getAlertLabel(flag: string) {
  switch (flag) {
    case "reajuste":
      return "Reajuste";
    case "renovacao":
      return "Renovação";
    case "cobranca_suspeita":
      return "Cobrança suspeita";
    case "vencimento_proximo":
      return "Próxima cobrança";
    default:
      return flag;
  }
}

export default function Subscriptions() {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["subscription-categories", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, nome, icone").order("nome");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: sourceData, isLoading } = useQuery({
    queryKey: ["subscriptions-sources", user?.id, currentScope],
    queryFn: async () => {
      let subscriptionsQuery = supabase.from("subscriptions").select("*");
      let recurringQuery = supabase.from("recurring_transactions").select("*").eq("ativa", true).eq("tipo", "expense");
      let transactionsQuery = supabase
        .from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope")
        .gte("data", new Date(Date.now() - 400 * 86400000).toISOString().split("T")[0])
        .eq("tipo", "expense");

      if (currentScope !== "all") {
        subscriptionsQuery = subscriptionsQuery.eq("scope", currentScope);
        recurringQuery = recurringQuery.eq("scope", currentScope);
        transactionsQuery = transactionsQuery.eq("scope", currentScope);
      }

      const [{ data: subscriptions }, { data: recurrings }, { data: transactions }] = await Promise.all([
        subscriptionsQuery.order("nome_servico"),
        recurringQuery.order("descricao"),
        transactionsQuery.order("data", { ascending: false }),
      ]);

      return {
        subscriptions: subscriptions || [],
        recurrings: recurrings || [],
        transactions: transactions || [],
      };
    },
    enabled: !!user,
  });

  const { data: summary } = useQuery({
    queryKey: ["subscriptions-summary", sourceData],
    queryFn: () =>
      calculateSubscriptionSummary({
        subscriptions: sourceData?.subscriptions || [],
        recurrings: sourceData?.recurrings || [],
        transactions: sourceData?.transactions || [],
      }),
    enabled: !!sourceData,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions-sources"] });
      toast.success("Assinatura excluída");
    },
    onError: (error: any) => toast.error("Erro ao excluir", { description: error.message }),
  });

  const manualItems = useMemo(
    () => (sourceData?.subscriptions || []).filter((item: any) => (item.origin || "manual") === "manual"),
    [sourceData],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Assinaturas"
        description="Visão consolidada de recorrências pagas, assinaturas manuais e padrões detectados"
      >
        <Dialog open={isOpen} onOpenChange={(next) => { setIsOpen(next); if (!next) setEditItem(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1 h-4 w-4" /> Nova assinatura</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{editItem ? "Editar assinatura" : "Nova assinatura"}</DialogTitle>
            </DialogHeader>
            <SubscriptionForm
              categories={categories}
              editData={editItem}
              defaultScope={currentScope === "all" ? "private" : currentScope}
              onSuccess={() => {
                setIsOpen(false);
                setEditItem(null);
                queryClient.invalidateQueries({ queryKey: ["subscriptions-sources"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs uppercase text-muted-foreground">Total mensal</p>
            <p className="text-xl font-bold font-mono">{formatCurrency(summary.totalsMonthly || 0)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs uppercase text-muted-foreground">Total anual</p>
            <p className="text-xl font-bold font-mono">{formatCurrency(summary.totalsAnnual || 0)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs uppercase text-muted-foreground">Itens consolidados</p>
            <p className="text-xl font-bold font-mono">{summary.items?.length || 0}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs uppercase text-muted-foreground">Alertas</p>
            <p className="text-xl font-bold font-mono">{summary.alertCount || 0}</p>
          </CardContent></Card>
        </div>
      )}

      {summary?.alerts?.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {summary.alerts.map((alert: any, index: number) => (
            <Card key={`${alert.tipo}-${index}`} className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold">{alert.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-1">{alert.mensagem}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !summary || summary.items.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Sem assinaturas identificadas"
          description="Cadastre uma assinatura manual ou mantenha recorrências/lançamentos consistentes para detecção automática."
        />
      ) : (
        <Tabs defaultValue="consolidado" className="space-y-4">
          <TabsList>
            <TabsTrigger value="consolidado">Consolidado</TabsTrigger>
            <TabsTrigger value="manual">Cadastro manual</TabsTrigger>
          </TabsList>

          <TabsContent value="consolidado" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Regras de detecção</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {(summary.detectionRules || []).map((rule: string) => (
                  <p key={rule}>• {rule}</p>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {summary.items.map((item: any) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.name}</p>
                          <Badge variant={item.origin === "manual" ? "default" : "secondary"}>
                            {item.origin === "manual" ? "Manual" : "Detectada"}
                          </Badge>
                          <Badge variant="outline">{FREQUENCY_LABELS[item.frequency] || item.frequency}</Badge>
                          {item.scope ? <ScopeBadge scope={item.scope} /> : null}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(item.alertFlags || []).map((flag: string) => (
                            <Badge key={flag} variant="outline" className="text-amber-600 border-amber-200">
                              <RefreshCw className="mr-1 h-3 w-3" />
                              {getAlertLabel(flag)}
                            </Badge>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          Base: {item.detectionMethod}
                        </p>
                        {item.nextChargeDate ? (
                          <p className="text-xs text-muted-foreground">
                            Próxima cobrança prevista: {formatDate(item.nextChargeDate)}
                          </p>
                        ) : null}
                        {item.renewalDate ? (
                          <p className="text-xs text-muted-foreground">
                            Renovação relevante: {formatDate(item.renewalDate)}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 gap-4 lg:min-w-[320px]">
                        <Metric label="Valor atual" value={formatCurrency(Number(item.currentValue || 0))} />
                        <Metric label="Total mensal" value={formatCurrency(Number(item.monthlyEquivalent || 0))} />
                        <Metric label="Total anual" value={formatCurrency(Number(item.annualEquivalent || 0))} />
                        <Metric
                          label="Dia base"
                          value={item.billingDay ? `Dia ${item.billingDay}` : "—"}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            {manualItems.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Sem cadastro manual"
                description="Use o botão acima para criar assinaturas explícitas quando quiser governança direta."
              />
            ) : (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {manualItems.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">{item.nome_servico}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{FREQUENCY_LABELS[item.frequency || "monthly"] || "Mensal"}</Badge>
                          <ScopeBadge scope={item.scope || "private"} />
                          <span className="text-xs text-muted-foreground">
                            {formatCurrency(Number(item.valor_mensal || 0))}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditItem(item); setIsOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono font-bold">{value}</p>
    </div>
  );
}

function SubscriptionForm({
  categories,
  editData,
  defaultScope,
  onSuccess,
}: {
  categories: any[];
  editData?: any;
  defaultScope: string;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    nome_servico: editData?.nome_servico || "",
    valor_mensal: editData?.valor_mensal?.toString() || "",
    frequency: editData?.frequency || "monthly",
    billing_day: editData?.billing_day?.toString() || editData?.data_cobranca?.toString() || "",
    next_charge_date: editData?.next_charge_date || "",
    renewal_date: editData?.renewal_date || "",
    annual_amount: editData?.annual_amount?.toString() || "",
    categoria_id: editData?.categoria_id || "",
    scope: editData?.scope || defaultScope || "private",
    status: editData?.status || "active",
    observacoes: editData?.observacoes || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.nome_servico || !form.valor_mensal) {
      toast.error("Preencha nome e valor");
      return;
    }

    setIsSubmitting(true);

    const payload: any = {
      user_id: user.id,
      nome_servico: form.nome_servico,
      valor_mensal: Number(form.valor_mensal),
      categoria_id: form.categoria_id || null,
      scope: form.scope,
      status: form.status,
      observacoes: form.observacoes || null,
      data_cobranca: form.billing_day ? Number(form.billing_day) : null,
      frequency: form.frequency,
      billing_day: form.billing_day ? Number(form.billing_day) : null,
      next_charge_date: form.next_charge_date || null,
      renewal_date: form.renewal_date || null,
      annual_amount: form.annual_amount ? Number(form.annual_amount) : null,
      origin: "manual",
      detection_method: "cadastro_manual",
      last_amount: editData?.valor_mensal ? Number(editData.valor_mensal) : null,
    };

    const { error } = editData
      ? await supabase.from("subscriptions").update(payload).eq("id", editData.id)
      : await supabase.from("subscriptions").insert(payload);

    setIsSubmitting(false);

    if (error) {
      toast.error("Erro ao salvar assinatura", { description: error.message });
      return;
    }

    toast.success(editData ? "Assinatura atualizada" : "Assinatura criada");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do serviço *</Label>
        <Input
          value={form.nome_servico}
          onChange={(e) => setForm((prev) => ({ ...prev, nome_servico: e.target.value }))}
          placeholder="Ex: Netflix, Canva Pro, domínio..."
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor atual *</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={form.valor_mensal}
            onChange={(e) => setForm((prev) => ({ ...prev, valor_mensal: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Frequência</Label>
          <Select value={form.frequency} onValueChange={(value) => setForm((prev) => ({ ...prev, frequency: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Dia base</Label>
          <Input
            type="number"
            min="1"
            max="31"
            value={form.billing_day}
            onChange={(e) => setForm((prev) => ({ ...prev, billing_day: e.target.value }))}
            placeholder="1-31"
          />
        </div>
        <div className="space-y-2">
          <Label>Próxima cobrança</Label>
          <Input
            type="date"
            value={form.next_charge_date}
            onChange={(e) => setForm((prev) => ({ ...prev, next_charge_date: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Renovação</Label>
          <Input
            type="date"
            value={form.renewal_date}
            onChange={(e) => setForm((prev) => ({ ...prev, renewal_date: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Total anual</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={form.annual_amount}
            onChange={(e) => setForm((prev) => ({ ...prev, annual_amount: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={form.categoria_id} onValueChange={(value) => setForm((prev) => ({ ...prev, categoria_id: value }))}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {categories.map((category: any) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.icone} {category.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Ativa</SelectItem>
              <SelectItem value="paused">Pausada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Escopo</Label>
        <Select value={form.scope} onValueChange={(value) => setForm((prev) => ({ ...prev, scope: value }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Pessoal</SelectItem>
            <SelectItem value="family">Família</SelectItem>
            <SelectItem value="business">Negócio/MEI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          value={form.observacoes}
          onChange={(e) => setForm((prev) => ({ ...prev, observacoes: e.target.value }))}
          rows={3}
          placeholder="Ex: renovação automática, cartão usado, observações operacionais..."
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {editData ? "Atualizar assinatura" : "Salvar assinatura"}
      </Button>
    </form>
  );
}
