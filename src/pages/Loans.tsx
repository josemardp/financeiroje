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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/format";
import { calculateLoanIndicators } from "@/services/financeEngine";
import type { LoanRaw, InstallmentRaw, ExtraAmortizationRaw } from "@/services/financeEngine/types";
import { toast } from "sonner";
import { CreditCard, Plus, Loader2, Trash2, ChevronDown, ChevronUp, DollarSign, Percent, Calendar } from "lucide-react";

const LOAN_TYPE_LABELS: Record<string, string> = {
  consignado: "Consignado", pessoal: "Pessoal", cartao: "Cartão", financiamento: "Financiamento", outro: "Outro",
};

export default function Loans() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  const { data: loans, isLoading } = useQuery({
    queryKey: ["loans"],
    queryFn: async () => {
      const { data } = await supabase.from("loans").select("*").order("created_at", { ascending: false });
      return (data || []).map((l: any): LoanRaw => ({
        id: l.id, nome: l.nome, valor_original: Number(l.valor_original), saldo_devedor: l.saldo_devedor ? Number(l.saldo_devedor) : null,
        taxa_juros_mensal: l.taxa_juros_mensal ? Number(l.taxa_juros_mensal) : null, cet_anual: l.cet_anual ? Number(l.cet_anual) : null,
        parcelas_total: l.parcelas_total, parcelas_restantes: l.parcelas_restantes, valor_parcela: l.valor_parcela ? Number(l.valor_parcela) : null,
        metodo_amortizacao: l.metodo_amortizacao, tipo: l.tipo, credor: l.credor, data_inicio: l.data_inicio, ativo: l.ativo,
      }));
    },
    enabled: !!user,
  });

  const { data: installments } = useQuery({
    queryKey: ["loan-installments"],
    queryFn: async () => {
      const { data } = await supabase.from("loan_installments").select("*").order("numero");
      return (data || []).map((i: any): InstallmentRaw => ({ id: i.id, emprestimo_id: i.emprestimo_id, numero: i.numero, valor: Number(i.valor), data_vencimento: i.data_vencimento, data_pagamento: i.data_pagamento, status: i.status }));
    },
    enabled: !!user,
  });

  const { data: amortizations } = useQuery({
    queryKey: ["extra-amortizations"],
    queryFn: async () => {
      const { data } = await supabase.from("extra_amortizations").select("*");
      return (data || []).map((a: any): ExtraAmortizationRaw => ({ id: a.id, emprestimo_id: a.emprestimo_id, valor: Number(a.valor), data: a.data, economia_juros_calculada: a.economia_juros_calculada ? Number(a.economia_juros_calculada) : null }));
    },
    enabled: !!user,
  });

  const { data: summary } = useQuery({
    queryKey: ["loan-summary", loans, installments],
    queryFn: async () => {
      if (!loans || !installments) return null;
      return await calculateLoanIndicators(loans, installments);
    },
    enabled: !!loans && !!installments,
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

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Dívidas" description="Gestão de empréstimos e simulador de amortização">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" /> Nova dívida</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
            <DialogHeader><DialogTitle>Cadastrar Dívida</DialogTitle></DialogHeader>
            <LoanForm onSuccess={() => { setIsOpen(false); queryClient.invalidateQueries({ queryKey: ["loans"] }); }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {summary && summary.loans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4 text-center"><p className="text-xs uppercase text-muted-foreground">Saldo devedor total</p><p className="text-xl font-mono font-bold text-destructive">{formatCurrency(summary.totalSaldoDevedor)}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-xs uppercase text-muted-foreground">Custo restante estimado</p><p className="text-xl font-mono font-bold text-warning">{formatCurrency(summary.totalCustoRestante)}</p></CardContent></Card>
          <Card><CardContent className="p-4 text-center"><p className="text-xs uppercase text-muted-foreground">Parcelas restantes</p><p className="text-xl font-mono font-bold">{summary.totalParcelas}</p></CardContent></Card>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !summary || summary.loans.length === 0 ? (
        <EmptyState icon={CreditCard} title="Sem dívidas cadastradas" description="Cadastre seus empréstimos para acompanhar saldo devedor, juros e simular estratégias de quitação."><Button onClick={() => setIsOpen(true)}><Plus className="mr-1 h-4 w-4" /> Adicionar dívida</Button></EmptyState>
      ) : (
        <div className="space-y-4">
          {summary.loans.map((indicator) => {
            const loan = loans?.find((l) => l.id === indicator.loanId);
            const isExpanded = expandedLoan === indicator.loanId;
            const loanInstallments = (installments || []).filter((i) => i.emprestimo_id === indicator.loanId);
            const paidPercent = loan ? Math.min(100, (indicator.totalJaPago / (indicator.totalJaPago + indicator.custoEstimadoRestante || 1)) * 100) : 0;

            return (
              <Card key={indicator.loanId}>
                <CardContent className="p-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-2">
                      <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight break-words">{indicator.loanName}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          {loan?.tipo && <Badge variant="outline" className="text-xs">{LOAN_TYPE_LABELS[loan.tipo] || loan.tipo}</Badge>}
                          {loan?.credor && <span className="text-xs text-muted-foreground break-words">{loan.credor}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpandedLoan(isExpanded ? null : indicator.loanId)}>{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(indicator.loanId)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Progresso de pagamento</span><span>{paidPercent.toFixed(0)}%</span></div>
                    <Progress value={paidPercent} className="h-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="text-center"><DollarSign className="mx-auto mb-1 h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Saldo</p><p className="text-sm font-mono font-bold break-words">{formatCurrency(indicator.saldoAtual)}</p></div>
                    <div className="text-center"><Calendar className="mx-auto mb-1 h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Parcelas</p><p className="text-sm font-mono font-bold">{indicator.parcelasRestantes}</p></div>
                    <div className="text-center"><Percent className="mx-auto mb-1 h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Taxa/mês</p><p className="text-sm font-mono font-bold">{indicator.taxaMensal.toFixed(2)}%</p></div>
                    <div className="text-center"><DollarSign className="mx-auto mb-1 h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Parcela</p><p className="text-sm font-mono font-bold break-words">{formatCurrency(loan?.valor_parcela || 0)}</p></div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div><span className="text-muted-foreground">Valor original:</span><span className="ml-2 font-mono">{formatCurrency(loan?.valor_original || 0)}</span></div>
                        <div><span className="text-muted-foreground">Total já pago:</span><span className="ml-2 font-mono text-success">{formatCurrency(indicator.totalJaPago)}</span></div>
                        <div><span className="text-muted-foreground">Custo restante:</span><span className="ml-2 font-mono text-warning">{formatCurrency(indicator.custoEstimadoRestante)}</span></div>
                        <div><span className="text-muted-foreground">CET anual:</span><span className="ml-2 font-mono">{indicator.cetAnual.toFixed(2)}%</span></div>
                      </div>

                      {indicator.impactoAmortizacaoExtra > 0 && (
                        <div className="rounded-lg bg-muted/50 p-3 text-sm">
                          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Economia potencial com amortização extra</p>
                          <p className="font-mono font-bold text-success">{formatCurrency(indicator.impactoAmortizacaoExtra)}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Estimativa simplificada baseada na taxa e prazo restante.</p>
                        </div>
                      )}

                      {loanInstallments.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs uppercase text-muted-foreground">Próximas parcelas</p>
                          <div className="space-y-1">
                            {loanInstallments.filter((i) => i.status !== "pago").slice(0, 5).map((inst) => (
                              <div key={inst.id} className="flex flex-col gap-1 border-b border-border/50 py-1 text-xs sm:flex-row sm:items-center sm:justify-between">
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
        </div>
      )}
    </div>
  );
}

function LoanForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ nome: "", valor_original: "", saldo_devedor: "", taxa_juros_mensal: "", cet_anual: "", parcelas_total: "", parcelas_restantes: "", valor_parcela: "", tipo: "pessoal", metodo_amortizacao: "price", credor: "", data_inicio: "", scope: "private", observacoes: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.nome || !form.valor_original) { toast.error("Preencha nome e valor original"); return; }
    setIsSubmitting(true);
    const { error } = await supabase.from("loans").insert({ user_id: user.id, nome: form.nome, valor_original: Number(form.valor_original), saldo_devedor: form.saldo_devedor ? Number(form.saldo_devedor) : Number(form.valor_original), taxa_juros_mensal: form.taxa_juros_mensal ? Number(form.taxa_juros_mensal) : null, cet_anual: form.cet_anual ? Number(form.cet_anual) : null, parcelas_total: form.parcelas_total ? Number(form.parcelas_total) : null, parcelas_restantes: form.parcelas_restantes ? Number(form.parcelas_restantes) : null, valor_parcela: form.valor_parcela ? Number(form.valor_parcela) : null, tipo: form.tipo as any, metodo_amortizacao: form.metodo_amortizacao as any, credor: form.credor || null, data_inicio: form.data_inicio || null, scope: form.scope as any, observacoes: form.observacoes || null });
    if (error) toast.error("Erro ao salvar", { description: error.message });
    else { toast.success("Dívida cadastrada!"); onSuccess(); }
    setIsSubmitting(false);
  };

  return <form onSubmit={handleSubmit} className="space-y-4"><div className="space-y-2"><Label>Nome da dívida *</Label><Input placeholder="Ex: Consignado Banco X" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Valor original (R$) *</Label><Input type="number" step="0.01" min="0.01" value={form.valor_original} onChange={(e) => setForm((f) => ({ ...f, valor_original: e.target.value }))} required /></div><div className="space-y-2"><Label>Saldo devedor (R$)</Label><Input type="number" step="0.01" value={form.saldo_devedor} onChange={(e) => setForm((f) => ({ ...f, saldo_devedor: e.target.value }))} /></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Taxa juros/mês (%)</Label><Input type="number" step="0.01" value={form.taxa_juros_mensal} onChange={(e) => setForm((f) => ({ ...f, taxa_juros_mensal: e.target.value }))} /></div><div className="space-y-2"><Label>CET anual (%)</Label><Input type="number" step="0.01" value={form.cet_anual} onChange={(e) => setForm((f) => ({ ...f, cet_anual: e.target.value }))} /></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="space-y-2"><Label>Parcelas total</Label><Input type="number" min="1" value={form.parcelas_total} onChange={(e) => setForm((f) => ({ ...f, parcelas_total: e.target.value }))} /></div><div className="space-y-2"><Label>Restantes</Label><Input type="number" min="0" value={form.parcelas_restantes} onChange={(e) => setForm((f) => ({ ...f, parcelas_restantes: e.target.value }))} /></div><div className="space-y-2"><Label>Valor parcela</Label><Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => setForm((f) => ({ ...f, valor_parcela: e.target.value }))} /></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tipo</Label><Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(LOAN_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Amortização</Label><Select value={form.metodo_amortizacao} onValueChange={(v) => setForm((f) => ({ ...f, metodo_amortizacao: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="price">Price (parcelas fixas)</SelectItem><SelectItem value="sac">SAC (parcelas decrescentes)</SelectItem></SelectContent></Select></div></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Credor</Label><Input placeholder="Ex: Banco do Brasil" value={form.credor} onChange={(e) => setForm((f) => ({ ...f, credor: e.target.value }))} /></div><div className="space-y-2"><Label>Data início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))} /></div></div><div className="space-y-2"><Label>Escopo</Label><Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "private" | "family" | "business" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Pessoal</SelectItem><SelectItem value="family">Família</SelectItem><SelectItem value="business">Negócio/MEI</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Observações</Label><Textarea placeholder="Notas adicionais..." value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={2} /></div><Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Cadastrar dívida</Button></form>;
}
