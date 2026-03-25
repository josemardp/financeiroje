import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import { KpiCard } from "@/components/shared/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Landmark, Wallet, Loader2, Trash2, DollarSign } from "lucide-react";

const ACCOUNT_TYPES: Record<string, string> = {
  conta_corrente: "Conta Corrente",
  poupanca: "Poupança",
  dinheiro: "Dinheiro",
  cartao: "Cartão de Crédito",
  investimento: "Investimento",
  caixa_negocio: "Caixa Negócio",
};

const ACCOUNT_ICONS: Record<string, string> = {
  conta_corrente: "🏦",
  poupanca: "🐖",
  dinheiro: "💵",
  cartao: "💳",
  investimento: "📈",
  caixa_negocio: "🏢",
};

export default function Accounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  // Calculate current balance: saldo_inicial + sum(income txns) - sum(expense txns) for each account
  const { data: balances } = useQuery({
    queryKey: ["account-balances"],
    queryFn: async () => {
      // PHASE 4.2: Align with engine rule — confirmed + null = official
      const { data: txns } = await supabase
        .from("transactions")
        .select("account_id, tipo, valor, data_status")
        .not("account_id", "is", null)
        .or("data_status.eq.confirmed,data_status.is.null");

      const map: Record<string, number> = {};
      (txns || []).forEach((t: any) => {
        const id = t.account_id;
        if (!map[id]) map[id] = 0;
        map[id] += t.tipo === "income" ? Number(t.valor) : -Number(t.valor);
      });
      return map;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["account-balances"] });
      toast.success("Conta removida");
    },
    onError: () => toast.error("Erro ao remover conta"),
  });

  const totalBalance = (accounts || [])
    .filter((a: any) => a.ativa)
    .reduce((sum: number, a: any) => {
      const txnBalance = balances?.[a.id] || 0;
      return sum + Number(a.saldo_inicial) + txnBalance;
    }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Contas" description="Gerencie suas contas e carteiras financeiras">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Nova conta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
            <AccountForm onSuccess={() => {
              setIsOpen(false);
              queryClient.invalidateQueries({ queryKey: ["accounts"] });
            }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Saldo Total" value={formatCurrency(totalBalance)} icon={DollarSign}
          variant={totalBalance >= 0 ? "success" : "destructive"} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !accounts || accounts.length === 0 ? (
        <EmptyState icon={Landmark} title="Sem contas cadastradas" description="Adicione suas contas bancárias e carteiras para acompanhar saldos reais.">
          <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar conta</Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a: any) => {
            const txnBalance = balances?.[a.id] || 0;
            const currentBalance = Number(a.saldo_inicial) + txnBalance;
            return (
              <Card key={a.id} className={!a.ativa ? "opacity-50" : ""}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{ACCOUNT_ICONS[a.tipo] || "🏦"}</span>
                    <div>
                      <CardTitle className="text-sm">{a.nome}</CardTitle>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_TYPES[a.tipo] || a.tipo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <ScopeBadge scope={a.scope} />
                    {!a.ativa && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold font-mono">{formatCurrency(currentBalance)}</p>
                      <p className="text-xs text-muted-foreground">Saldo inicial: {formatCurrency(Number(a.saldo_inicial))}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(a.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AccountForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    tipo: "conta_corrente",
    saldo_inicial: "",
    scope: "private",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.nome.trim()) {
      toast.error("Preencha o nome da conta");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.from("accounts").insert({
      user_id: user.id,
      nome: form.nome.trim(),
      tipo: form.tipo,
      saldo_inicial: Number(form.saldo_inicial) || 0,
      scope: form.scope as any,
    });
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
    } else {
      toast.success("Conta criada!");
      onSuccess();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome da conta</Label>
        <Input placeholder="Ex: Nubank, Caixa, Carteira..." value={form.nome}
          onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => setForm(f => ({ ...f, tipo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{ACCOUNT_ICONS[k]} {v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Saldo inicial (R$)</Label>
          <Input type="number" step="0.01" placeholder="0,00" value={form.saldo_inicial}
            onChange={(e) => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Escopo</Label>
        <Select value={form.scope} onValueChange={(v) => setForm(f => ({ ...f, scope: v as "private" | "family" | "business" }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="private">Pessoal</SelectItem>
            <SelectItem value="family">Família</SelectItem>
            <SelectItem value="business">Negócio/MEI</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Criar conta
      </Button>
    </form>
  );
}
