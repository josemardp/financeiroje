import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { DataStatusBadge } from "@/components/shared/DataStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/format";
import { calculateMonthlySummary, filterOfficialTransactions } from "@/services/financeEngine";
import type { TransactionRaw, MonthlySummary } from "@/services/financeEngine/types";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowLeftRight,
  Plus,
  Sparkles,
  Bell,
  Landmark,
  Shield,
  AlertTriangle,
} from "lucide-react";

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { currentScope, scopeLabel } = useScope();

  const { data: rawTransactions } = useQuery({
    queryKey: ["dashboard-transactions", user?.id, currentScope],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      let query = supabase
        .from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)")
        .gte("data", startOfMonth)
        .lte("data", endOfMonth);

      if (currentScope !== "all") {
        query = query.eq("scope", currentScope);
      }

      const { data } = await query.order("data", { ascending: false });

      return (data || []).map((t: any): TransactionRaw => ({
        id: t.id,
        valor: Number(t.valor),
        tipo: t.tipo,
        data: t.data,
        descricao: t.descricao,
        categoria_id: t.categoria_id,
        categoria_nome: t.categories?.nome,
        categoria_icone: t.categories?.icone,
        scope: t.scope,
        data_status: t.data_status,
        source_type: t.source_type,
        confidence: t.confidence,
        e_mei: t.e_mei,
      }));
    },
    enabled: !!user,
  });

  const { data: unreadAlerts } = useQuery({
    queryKey: ["dashboard-alerts", user?.id, currentScope],
    queryFn: async () => {
      let query = supabase.from("alerts").select("*").eq("lido", false);

      if (currentScope !== "all") {
        query = query.eq("scope", currentScope);
      }

      const { data } = await query.order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: accounts } = useQuery({
    queryKey: ["dashboard-accounts", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("*").eq("ativa", true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: goalsAtRisk } = useQuery({
    queryKey: ["dashboard-goals", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("goals").select("*").eq("ativo", true).limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: summary } = useQuery<MonthlySummary>({
    queryKey: ["dashboard-summary", rawTransactions],
    queryFn: () => calculateMonthlySummary(rawTransactions!),
    enabled: !!rawTransactions && rawTransactions.length > 0,
  });

  const { data: summaryConfirmed } = useQuery<MonthlySummary>({
    queryKey: ["dashboard-summary-confirmed", rawTransactions],
    queryFn: () => calculateMonthlySummary(filterOfficialTransactions(rawTransactions!)),
    enabled: !!rawTransactions && rawTransactions.length > 0,
  });

  const recentTransactions = rawTransactions ? rawTransactions.slice(0, 5) : [];
  const totalAccountBalance = (accounts || []).reduce((acc: number, curr: any) => acc + Number(curr.saldo_actual || curr.saldo_inicial || 0), 0);

  const prefs = (profile?.preferences || {}) as any;
  const reserveValue = Number(prefs.reserva_emergencia_valor || 0);
  const reserveConfigured = !!prefs.reserva_emergencia_valor;

  const isLoading = !rawTransactions;
  const hasData = summary && (summary.totalIncome > 0 || summary.totalExpense > 0);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in sm:space-y-6">
        <PageHeader title="Dashboard" description={`Visão geral (${scopeLabel})`} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-5"><div className="h-20 bg-muted animate-pulse rounded-lg" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in sm:space-y-6">
      <PageHeader title={`Olá, ${profile?.nome || "Usuário"}`} description={`Visão geral (${scopeLabel})`}>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            asChild
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white border-green-600"
          >
            <Link to="/captura">
              <Sparkles className="mr-1 h-4 w-4" />
              Captura Inteligente
            </Link>
          </Button>
          <Button variant="secondary" asChild className="w-full sm:w-auto">
            <Link to="/transacoes">
              <Plus className="mr-1 h-4 w-4" />
              Nova transação
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Receitas" value={formatCurrency(summaryConfirmed?.totalIncome || 0)} icon={TrendingUp} variant="success" />
        <KpiCard title="Despesas" value={formatCurrency(summaryConfirmed?.totalExpense || 0)} icon={TrendingDown} variant="destructive" />
        <KpiCard title="Saldo Líquido do Mês" value={formatCurrency(summaryConfirmed?.balance || 0)} icon={DollarSign}
          variant={summaryConfirmed && summaryConfirmed.balance >= 0 ? "success" : "destructive"} />
        <KpiCard title="Taxa de Economia" value={`${(summaryConfirmed?.savingsRate || 0).toFixed(1)}%`} icon={PiggyBank}
          variant={summaryConfirmed && summaryConfirmed.savingsRate >= 20 ? "success" : "warning"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(accounts || []).length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Landmark className="h-4 w-4" /> Saldo das Contas</CardTitle>
              <Button variant="ghost" size="sm" asChild><Link to="/contas">Ver</Link></Button>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{formatCurrency(totalAccountBalance)}</p>
              <p className="text-xs text-muted-foreground mt-1">{(accounts || []).length} conta(s) ativa(s) — dado real</p>
            </CardContent>
          </Card>
        )}

        {reserveConfigured && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Reserva de Emergência</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-mono">{formatCurrency(reserveValue)}</p>
              {summaryConfirmed && summaryConfirmed.totalExpense > 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Cobertura: {(reserveValue / summaryConfirmed.totalExpense).toFixed(1)} meses de despesa
                  {prefs.reserva_emergencia_meses_meta && ` / meta: ${prefs.reserva_emergencia_meses_meta} meses`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Sem despesas confirmadas para calcular cobertura
                  {prefs.reserva_emergencia_meses_meta && ` — meta: ${prefs.reserva_emergencia_meses_meta} meses`}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {(goalsAtRisk || []).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-warning"><AlertTriangle className="h-4 w-4" /> Metas em Risco</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(goalsAtRisk || []).slice(0, 3).map((g: any) => (
                  <div key={g.id} className="flex items-start justify-between gap-2 text-sm">
                    <span className="line-clamp-2 min-w-0 flex-1 leading-tight">{g.nome}</span>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {formatCurrency(Number(g.valor_alvo) - Number(g.valor_atual || 0))} restante
                    </span>
                  </div>
                ))}
                <Button variant="ghost" size="sm" asChild className="w-full"><Link to="/metas">Ver metas</Link></Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {summary && summary.suggestedCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-[11px] leading-4 text-muted-foreground sm:items-center sm:text-xs">
          <DataStatusBadge status="suggested" showLabel={false} />
          <span>{summary.suggestedCount} transações sugerida(s) pendente(s) — não incluídas nos KPIs.</span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3 lg:gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Transações Recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/transacoes">Ver todas</Link></Button>
          </CardHeader>
          <CardContent className="pt-0">
            {!hasData ? (
              <EmptyState icon={ArrowLeftRight} title="Sem transações este mês" description="Comece registrando receitas e despesas.">
                <Button asChild size="sm"><Link to="/transacoes"><Plus className="h-4 w-4 mr-1" /> Adicionar</Link></Button>
              </EmptyState>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start justify-between gap-2.5 border-b border-border py-2 last:border-0 sm:items-center sm:gap-3"
                  >
                    <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                      <span className="shrink-0 text-lg">{t.categoria_icone || "📋"}</span>
                      <div className="min-w-0 max-w-[10.5rem] sm:max-w-none">
                        <p className="line-clamp-2 text-sm font-medium leading-tight">{t.descricao || t.categoria_nome || "Sem descrição"}</p>
                        <p className="truncate text-[11px] leading-4 text-muted-foreground">{formatDate(t.data)}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 pl-1 sm:flex-row sm:items-center sm:gap-2 sm:pl-2">
                      <DataStatusBadge status={t.data_status || "confirmed"} showLabel={false} />
                      <span className={`max-w-[6.75rem] truncate text-right text-sm font-mono font-semibold leading-tight ${t.tipo === "income" ? "text-success" : "text-destructive"}`}>
                        {t.tipo === "income" ? "+" : "-"}{formatCurrency(t.valor)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Alertas</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/alertas">Ver todos</Link></Button>
          </CardHeader>
          <CardContent className="pt-0">
            {(!unreadAlerts || unreadAlerts.length === 0) ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum alerta pendente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {unreadAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-start gap-2 rounded-lg bg-muted/50 px-2.5 py-1.5">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{alert.titulo}</p>
                      <p className="mt-px line-clamp-2 text-[11px] leading-[1.1rem] text-muted-foreground break-words">
                        {alert.mensagem}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {summaryConfirmed && summaryConfirmed.expenseByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Despesas por Categoria (dados oficiais)</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summaryConfirmed.expenseByCategory.slice(0, 6).map((cat) => (
                <div key={cat.categoryId || "none"} className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{cat.categoryIcon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{cat.categoryName}</span>
                      <span className="font-mono text-muted-foreground">{formatCurrency(cat.total)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, cat.percentage)}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">{cat.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
