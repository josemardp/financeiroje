import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "@/lib/format";
import { DataStatusBadge } from "@/components/shared/DataStatusBadge";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowLeftRight,
  Plus,
  LayoutDashboard,
  Bell,
} from "lucide-react";

export default function Dashboard() {
  const { user, profile } = useAuth();

  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary", user?.id],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

      const { data: transactions } = await supabase
        .from("transactions")
        .select("valor, tipo, data, descricao, data_status, scope, categoria_id, categories(nome, icone)")
        .gte("data", startOfMonth)
        .lte("data", endOfMonth)
        .eq("data_status", "confirmed")
        .order("data", { ascending: false });

      const receitas = (transactions || [])
        .filter((t: any) => t.tipo === "income")
        .reduce((sum: number, t: any) => sum + Number(t.valor), 0);

      const despesas = (transactions || [])
        .filter((t: any) => t.tipo === "expense")
        .reduce((sum: number, t: any) => sum + Number(t.valor), 0);

      const { data: alerts } = await supabase
        .from("alerts")
        .select("*")
        .eq("lido", false)
        .order("created_at", { ascending: false })
        .limit(5);

      return {
        receitas,
        despesas,
        saldo: receitas - despesas,
        economia: receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0,
        recentTransactions: (transactions || []).slice(0, 8),
        unreadAlerts: alerts || [],
      };
    },
    enabled: !!user,
  });

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

  const hasData = summary && (summary.receitas > 0 || summary.despesas > 0);

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Receitas"
          value={formatCurrency(summary?.receitas || 0)}
          icon={TrendingUp}
          variant="success"
        />
        <KpiCard
          title="Despesas"
          value={formatCurrency(summary?.despesas || 0)}
          icon={TrendingDown}
          variant="destructive"
        />
        <KpiCard
          title="Saldo"
          value={formatCurrency(summary?.saldo || 0)}
          icon={DollarSign}
          variant={summary && summary.saldo >= 0 ? "success" : "destructive"}
        />
        <KpiCard
          title="Taxa de Economia"
          value={`${(summary?.economia || 0).toFixed(1)}%`}
          icon={PiggyBank}
          variant={summary && summary.economia >= 20 ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
                {summary?.recentTransactions.map((t: any) => (
                  <div key={t.data + t.descricao + t.valor} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">{t.categories?.icone || "📋"}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.descricao || t.categories?.nome || "Sem descrição"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(t.data)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <DataStatusBadge status={t.data_status} showLabel={false} />
                      <span className={`text-sm font-mono font-semibold ${t.tipo === "income" ? "text-success" : "text-destructive"}`}>
                        {t.tipo === "income" ? "+" : "-"}{formatCurrency(Number(t.valor))}
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
            <Button variant="ghost" size="sm" asChild>
              <Link to="/alertas">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {(!summary?.unreadAlerts || summary.unreadAlerts.length === 0) ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum alerta pendente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.unreadAlerts.map((alert: any) => (
                  <div key={alert.id} className="flex gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="mt-0.5">
                      <Bell className="h-4 w-4 text-warning" />
                    </div>
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
    </div>
  );
}
