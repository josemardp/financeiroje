import { useAuth } from "@/contexts/AuthContext";
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
import { calculateMonthlySummary, filterOfficialTransactions, filterPendingTransactions } from "@/services/financeEngine";
import type { TransactionRaw } from "@/services/financeEngine/types";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowLeftRight,
  Plus,
  Bell,
} from "lucide-react";

export default function Dashboard() {
  const { user, profile } = useAuth();

  const { data: rawTransactions } = useQuery({
    queryKey: ["dashboard-transactions", user?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data } = await supabase
        .from("transactions")
        .select("id, valor, tipo, data, descricao, data_status, scope, source_type, confidence, e_mei, categoria_id, categories(nome, icone)")
        .gte("data", startOfMonth)
        .lte("data", endOfMonth)
        .order("data", { ascending: false });

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
    queryKey: ["dashboard-alerts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .eq("lido", false)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  // ENGINE: all math happens here, not inline
  // HARDENING: KPIs oficiais usam SOMENTE transações confirmed
  const summary = rawTransactions ? calculateMonthlySummary(rawTransactions) : null;
  const officialTransactions = rawTransactions ? filterOfficialTransactions(rawTransactions) : [];
  const summaryConfirmed = officialTransactions.length > 0 ? calculateMonthlySummary(officialTransactions) : null;
  const pendingTransactions = rawTransactions ? filterPendingTransactions(rawTransactions) : [];
  const recentTransactions = rawTransactions?.slice(0, 8) || [];

  const isLoading = !rawTransactions;
  const hasData = summary && (summary.totalIncome > 0 || summary.totalExpense > 0);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader title="Dashboard" description="Carregando dados..." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}><CardContent className="p-5"><div className="h-20 bg-muted animate-pulse rounded-lg" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`Olá, ${profile?.nome || "Usuário"}`}
        description="Visão geral das suas finanças este mês"
      >
        <Button asChild>
          <Link to="/transacoes"><Plus className="h-4 w-4 mr-1" /> Nova transação</Link>
        </Button>
      </PageHeader>

      {/* KPIs — dados confirmados para confiabilidade */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Receitas"
          value={formatCurrency(summaryConfirmed?.totalIncome || 0)}
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          title="Despesas"
          value={formatCurrency(summaryConfirmed?.totalExpense || 0)}
          icon={TrendingDown}
          variant="destructive"
        />
        <KpiCard
          title="Saldo"
          value={formatCurrency(summaryConfirmed?.balance || 0)}
          icon={DollarSign}
          variant={summaryConfirmed && summaryConfirmed.balance >= 0 ? "success" : "destructive"}
        />
        <KpiCard
          title="Taxa de Economia"
          value={`${(summaryConfirmed?.savingsRate || 0).toFixed(1)}%`}
          icon={PiggyBank}
          variant={summaryConfirmed && summaryConfirmed.savingsRate >= 20 ? "success" : "warning"}
        />
      </div>

      {/* Data quality indicator */}
      {summary && summary.suggestedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
          <DataStatusBadge status="suggested" showLabel={false} />
          <span>{summary.suggestedCount} transação(ões) sugerida(s) pendente(s) de confirmação — não incluídas nos KPIs acima.</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Transações Recentes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/transacoes">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="Sem transações este mês"
                description="Comece registrando suas receitas e despesas para acompanhar suas finanças."
              >
                <Button asChild size="sm">
                  <Link to="/transacoes"><Plus className="h-4 w-4 mr-1" /> Adicionar transação</Link>
                </Button>
              </EmptyState>
            ) : (
              <div className="space-y-2">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">{t.categoria_icone || "📋"}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.descricao || t.categoria_nome || "Sem descrição"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.data)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <DataStatusBadge status={t.data_status || "confirmed"} showLabel={false} />
                      <span className={`text-sm font-mono font-semibold ${t.tipo === "income" ? "text-success" : "text-destructive"}`}>
                        {t.tipo === "income" ? "+" : "-"}{formatCurrency(t.valor)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Alertas</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/alertas">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(!unreadAlerts || unreadAlerts.length === 0) ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum alerta pendente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {unreadAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex gap-2 p-2 rounded-lg bg-muted/50">
                    <Bell className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{alert.titulo}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{alert.mensagem}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expense by category breakdown */}
      {summary && summary.expenseByCategory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.expenseByCategory.slice(0, 6).map((cat) => (
                <div key={cat.categoryId || "none"} className="flex items-center gap-3">
                  <span className="text-lg shrink-0">{cat.categoryIcon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{cat.categoryName}</span>
                      <span className="font-mono text-muted-foreground">{formatCurrency(cat.total)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      />
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
