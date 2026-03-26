import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format";
import { calculateLoanIndicators, calculateDebtStrategies } from "@/services/financeEngine";
import type { LoanRaw, InstallmentRaw } from "@/services/financeEngine/types";
import { toast } from "sonner";
import {
  CreditCard,
  Plus,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Percent,
  Calendar,
  TrendingUp,
  Shield,
} from "lucide-react";

const LOAN_TYPE_LABELS: Record<string, string> = {
  consignado: "Consignado",
  pessoal: "Pessoal",
  cartao: "Cartão",
  financiamento: "Financiamento",
  outro: "Outro",
};

const STRATEGY_LABELS: Record<string, string> = {
  current: "Cenário atual",
  extra: "Pagamento extra",
  avalanche: "Avalanche",
  snowball: "Bola de neve",
};

export default function Loans() {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);
  const [extraPayment, setExtraPayment] = useState("300");

  const { data: loans, isLoading } = useQuery({
    queryKey: ["loans", user?.id, currentScope],
    queryFn: async () => {
      let query = supabase.from("loans").select("*").order("created_at", { ascending: false });
      if (currentScope !== "all") query = query.eq("scope", currentScope);

      const { data } = await query;
      return (data || []).map((l: any): LoanRaw => ({
        id: l.id,
        nome: l.nome,
        valor_original: Number(l.valor_original),
        saldo_devedor: l.saldo_devedor ? Number(l.saldo_devedor) : null,
        taxa_juros_mensal: l.taxa_juros_mensal ? Number(l.taxa_juros_mensal) : null,
        cet_anual: l.cet_anual ? Number(l.cet_anual) : null,
        parcelas_total: l.parcelas_total,
        parcelas_restantes: l.parcelas_restantes,
        valor_parcela: l.valor_parcela ? Number(l.valor_parcela) : null,
        metodo_amortizacao: l.metodo_amortizacao,
        tipo: l.tipo,
        credor: l.credor,
        data_inicio: l.data_inicio,
        ativo: l.ativo,
        scope: l.scope,
      } as any));
    },
    enabled: !!user,
  });

  const { data: installments } = useQuery({
    queryKey: ["loan-installments", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("loan_installments").select("*").order("numero");
      return (data || []).map((i: any): InstallmentRaw => ({
        id: i.id,
        emprestimo_id: i.emprestimo_id,
        numero: i.numero,
        valor: Number(i.valor),
        data_vencimento: i.data_vencimento,
        data_pagamento: i.data_pagamento,
        status: i.status,
      }));
    },
    enabled: !!user,
  });

  const visibleLoanIds = useMemo(() => new Set((loans || []).map((loan) => loan.id)), [loans]);
  const scopedInstallments = useMemo(
    () => (installments || []).filter((item) => visibleLoanIds.has(item.emprestimo_id)),
    [installments, visibleLoanIds],
  );

  const { data: summary } = useQuery({
    queryKey: ["loan-summary", loans, scopedInstallments],
    queryFn: async () => {
      if (!loans || !scopedInstallments) return null;
      return calculateLoanIndicators(loans as any, scopedInstallments as any);
    },
    enabled: !!loans && !!scopedInstallments,
  });

  const { data: strategyResult } = useQuery({
    queryKey: ["loan-strategies", loans, scopedInstallments, extraPayment],
    queryFn: async () => {
      if (!loans || !scopedInstallments) return null;
      return calculateDebtStrategies({
        loans,
        installments: scopedInstallments,
        extraPayment: Number(extraPayment || 0),
      });
    },
    enabled: !!loans && !!scopedInstallments,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast.success("Dívida excluída");
    },
  });

  const recommendedScenario = strategyResult?.scenarios?.find(
    (scenario: any) => scenario.key === strategyResult?.recommendedKey,
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dívidas" description="Gestão de empréstimos com simulação premium determinística">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nova dívida</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar Dívida</DialogTitle></DialogHeader>
            <LoanForm onSuccess={() => { setIsOpen(false); queryClient.invalidateQueries({ queryKey: ["loans"] }); }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {summary && summary.loans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Saldo devedor total</p>
            <p className="text-xl font-bold font-mono text-destructive">{formatCurrency(summary.totalSaldoDevedor)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Custo restante estimado</p>
            <p className="text-xl font-bold font-mono text-warning">{formatCurrency(summary.totalCustoRestante)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Parcelas restantes</p>
            <p className="text-xl font-bold font-mono">{summary.totalParcelas}</p>
          </CardContent></Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !summary || summary.loans.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Sem dívidas cadastradas"
          description="Cadastre seus empréstimos para acompanhar saldo devedor, juros e comparar estratégias de quitação."
        >
          <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar dívida</Button>
        </EmptyState>
      ) : (
        <Tabs defaultValue="carteira" className="space-y-4">
          <TabsList>
            <TabsTrigger value="carteira">Carteira</TabsTrigger>
            <TabsTrigger value="simulacoes">Simulações premium</TabsTrigger>
          </TabsList>

          <TabsContent value="carteira" className="space-y-4">
            {summary.loans.map((indicator: any) => {
              const loan = loans?.find((l) => l.id === indicator.loanId);
              const isExpanded = expandedLoan === indicator.loanId;
              const loanInstallments = scopedInstallments.filter((i) => i.emprestimo_id === indicator.loanId);
              const paidPercent = loan
                ? Math.min(100, (indicator.totalJaPago / ((indicator.totalJaPago + indicator.custoEstimadoRestante) || 1)) * 100)
                : 0;

              return (
                <Card key={indicator.loanId}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{indicator.loanName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {loan?.tipo && <Badge variant="outline" className="text-xs">{LOAN_TYPE_LABELS[loan.tipo] || loan.tipo}</Badge>}
                            {loan?.scope ? <ScopeBadge scope={loan.scope} /> : null}
                            {loan?.credor && <span className="text-xs text-muted-foreground">{loan.credor}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedLoan(isExpanded ? null : indicator.loanId)}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(indicator.loanId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progresso de pagamento</span>
                        <span>{paidPercent.toFixed(0)}%</span>
                      </div>
                      <Progress value={paidPercent} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="text-center">
                        <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="text-sm font-mono font-bold">{formatCurrency(indicator.saldoAtual)}</p>
                      </div>
                      <div className="text-center">
                        <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Parcelas</p>
                        <p className="text-sm font-mono font-bold">{indicator.parcelasRestantes}</p>
                      </div>
                      <div className="text-center">
                        <Percent className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Taxa/mês</p>
                        <p className="text-sm font-mono font-bold">{indicator.taxaMensal.toFixed(2)}%</p>
                      </div>
                      <div className="text-center">
                        <DollarSign className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Parcela</p>
                        <p className="text-sm font-mono font-bold">{formatCurrency(loan?.valor_parcela || 0)}</p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-border space-y-3">
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Valor original:</span>
                            <span className="font-mono ml-2">{formatCurrency(loan?.valor_original || 0)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total já pago:</span>
                            <span className="font-mono ml-2 text-success">{formatCurrency(indicator.totalJaPago)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Custo restante:</span>
                            <span className="font-mono ml-2 text-warning">{formatCurrency(indicator.custoEstimadoRestante)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">CET anual:</span>
                            <span className="font-mono ml-2">{indicator.cetAnual.toFixed(2)}%</span>
                          </div>
                        </div>

                        {indicator.impactoAmortizacaoExtra > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3 text-sm">
                            <p className="font-medium text-xs text-muted-foreground uppercase mb-1">Economia potencial com amortização extra</p>
                            <p className="font-mono text-success font-bold">{formatCurrency(indicator.impactoAmortizacaoExtra)}</p>
                            <p className="text-xs text-muted-foreground mt-1">Estimativa simplificada baseada em taxa e prazo restante.</p>
                          </div>
                        )}

                        {loanInstallments.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase mb-2">Próximas parcelas</p>
                            <div className="space-y-1">
                              {loanInstallments
                                .filter((i) => i.status !== "pago")
                                .slice(0, 5)
                                .map((inst) => (
                                  <div key={inst.id} className="flex justify-between text-xs py-1 border-b border-border/50">
                                    <span>#{inst.numero} — {inst.data_vencimento}</span>
                                    <span className="font-mono">{formatCurrency(inst.valor)}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="simulacoes" className="space-y-4">
            <Card>
              <CardContent className="p-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                  <Label>Pagamento extra mensal</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={extraPayment}
                    onChange={(e) => setExtraPayment(e.target.value)}
                    className="w-[220px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    O cálculo acontece no backend determinístico. A UI apenas exibe os cenários.
                  </p>
                </div>
                {recommendedScenario ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm font-semibold">Estratégia recomendada</span>
                    </div>
                    <p className="mt-2 font-bold">{STRATEGY_LABELS[recommendedScenario.key] || recommendedScenario.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Menor custo de juros com prazo estimado de {recommendedScenario.payoffMonths} mês(es).
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              {(strategyResult?.scenarios || []).map((scenario: any) => (
                <Card key={scenario.key} className={scenario.key === strategyResult?.recommendedKey ? "border-primary" : ""}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{STRATEGY_LABELS[scenario.key] || scenario.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Extra aplicado: {formatCurrency(Number(scenario.extraPaymentApplied || 0))}
                        </p>
                      </div>
                      {scenario.key === strategyResult?.recommendedKey ? (
                        <Badge>Recomendada</Badge>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <ScenarioMetric label="Prazo estimado" value={`${scenario.payoffMonths} mês(es)`} />
                      <ScenarioMetric label="Data final" value={scenario.payoffDate} />
                      <ScenarioMetric label="Custo total" value={formatCurrency(Number(scenario.totalPaid || 0))} />
                      <ScenarioMetric label="Juros totais" value={formatCurrency(Number(scenario.totalInterest || 0))} />
                    </div>

                    <div>
                      <p className="text-xs uppercase text-muted-foreground mb-2">Ordem de quitação</p>
                      <div className="flex flex-wrap gap-2">
                        {(scenario.payoffOrder || []).length ? (
                          scenario.payoffOrder.map((name: string) => (
                            <Badge key={name} variant="outline">{name}</Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Sem dados suficientes</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {strategyResult?.scenarios?.length ? (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Comparação entre estratégias
                  </p>
                  {strategyResult.scenarios.map((scenario: any) => (
                    <div key={`comparison-${scenario.key}`} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{STRATEGY_LABELS[scenario.key] || scenario.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Prazo {scenario.payoffMonths} mês(es) • juros {formatCurrency(Number(scenario.totalInterest || 0))}
                        </p>
                      </div>
                      <p className="font-mono font-bold">{formatCurrency(Number(scenario.totalPaid || 0))}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ScenarioMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono font-bold">{value}</p>
    </div>
  );
}

function LoanForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    valor_original: "",
    saldo_devedor: "",
    taxa_juros_mensal: "",
    cet_anual: "",
    parcelas_total: "",
    parcelas_restantes: "",
    valor_parcela: "",
    tipo: "pessoal",
    metodo_amortizacao: "price",
    credor: "",
    data_inicio: "",
    scope: "private",
    observacoes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.nome || !form.valor_original) {
      toast.error("Preencha nome e valor original");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from("loans").insert({
      user_id: user.id,
      nome: form.nome,
      valor_original: Number(form.valor_original),
      saldo_devedor: form.saldo_devedor ? Number(form.saldo_devedor) : Number(form.valor_original),
      taxa_juros_mensal: form.taxa_juros_mensal ? Number(form.taxa_juros_mensal) : null,
      cet_anual: form.cet_anual ? Number(form.cet_anual) : null,
      parcelas_total: form.parcelas_total ? Number(form.parcelas_total) : null,
      parcelas_restantes: form.parcelas_restantes ? Number(form.parcelas_restantes) : null,
      valor_parcela: form.valor_parcela ? Number(form.valor_parcela) : null,
      tipo: form.tipo as any,
      metodo_amortizacao: form.metodo_amortizacao as any,
      credor: form.credor || null,
      data_inicio: form.data_inicio || null,
      scope: form.scope as any,
      observacoes: form.observacoes || null,
    });
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Dívida cadastrada!");
      onSuccess();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome da dívida *</Label>
        <Input placeholder="Ex: Consignado Banco X" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Valor original (R$) *</Label>
          <Input type="number" step="0.01" min="0.01" value={form.valor_original} onChange={(e) => setForm((f) => ({ ...f, valor_original: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label>Saldo devedor (R$)</Label>
          <Input type="number" step="0.01" value={form.saldo_devedor} onChange={(e) => setForm((f) => ({ ...f, saldo_devedor: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Taxa juros/mês (%)</Label>
          <Input type="number" step="0.01" value={form.taxa_juros_mensal} onChange={(e) => setForm((f) => ({ ...f, taxa_juros_mensal: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>CET anual (%)</Label>
          <Input type="number" step="0.01" value={form.cet_anual} onChange={(e) => setForm((f) => ({ ...f, cet_anual: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Parcelas total</Label>
          <Input type="number" min="1" value={form.parcelas_total} onChange={(e) => setForm((f) => ({ ...f, parcelas_total: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Restantes</Label>
          <Input type="number" min="0" value={form.parcelas_restantes} onChange={(e) => setForm((f) => ({ ...f, parcelas_restantes: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Valor parcela</Label>
          <Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => setForm((f) => ({ ...f, valor_parcela: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(LOAN_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Amortização</Label>
          <Select value={form.metodo_amortizacao} onValueChange={(v) => setForm((f) => ({ ...f, metodo_amortizacao: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="price">Price (parcelas fixas)</SelectItem>
              <SelectItem value="sac">SAC (parcelas decrescentes)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Credor</Label>
          <Input placeholder="Ex: Banco do Brasil" value={form.credor} onChange={(e) => setForm((f) => ({ ...f, credor: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Data início</Label>
          <Input type="date" value={form.data_inicio} onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Escopo</Label>
        <Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "private" | "family" | "business" }))}>
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
        <Textarea placeholder="Notas adicionais..." value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={2} />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Cadastrar dívida
      </Button>
    </form>
  );
}
