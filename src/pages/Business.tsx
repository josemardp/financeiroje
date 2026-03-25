
/**
 * FinanceAI — Módulo Business / MEI
 * 
 * Dashboad operacional para microempreendedores:
 * 1. Receita Bruta, Custos e Lucro
 * 2. Monitoramento do Limite do MEI
 * 3. Alertas de aproximação do teto
 * 4. Visão anual acumulada
 */

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency, formatPercent } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { backendEngine } from "@/services/financeEngine/backend";
import { filterOfficialTransactions } from "@/services/financeEngine/types";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  AlertCircle, 
  Briefcase, 
  DollarSign, 
  PieChart, 
  Loader2,
  CheckCircle2
} from "lucide-react";

export default function Business() {
  const currentYear = new Date().getFullYear();

  // 1. Buscar transações do escopo business do ano atual
  const { data: transactions = [], isLoading: loadingTxns } = useQuery({
    queryKey: ["business-transactions-year", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          id, valor, tipo, data, scope, data_status, e_mei, categoria_id,
          categories(nome, is_business_cost)
        `)
        .eq("scope", "business")
        .gte("data", `${currentYear}-01-01`)
        .lte("data", `${currentYear}-12-31`);

      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        categoria_nome: (t.categories as any)?.nome,
        categoria_is_business_cost: (t.categories as any)?.is_business_cost
      }));
    }
  });

  // 2. Buscar configurações do MEI
  const { data: meiSettings } = useQuery({
    queryKey: ["mei-settings", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mei_settings")
        .select("*")
        .eq("ano_referencia", currentYear)
        .maybeSingle();

      if (error) throw error;
      return data || { limite_anual: 81000, alerta_threshold_percent: 80 };
    }
  });

  // 3. Calcular indicadores via Engine
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["mei-summary", currentYear, transactions.length, meiSettings?.limite_anual],
    queryFn: async () => {
      const officialTxns = filterOfficialTransactions(transactions as any);
      return backendEngine.calculateMeiSummary(officialTxns as any, Number(meiSettings?.limite_anual || 81000));
    },
    enabled: transactions.length >= 0
  });

  if (loadingTxns || loadingSummary) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const alertConfig = {
    critical: { icon: AlertCircle, variant: "destructive" as const, title: "Atenção Crítica: Limite Quase Atingido" },
    warning: { icon: AlertTriangle, variant: "default" as const, title: "Alerta: Limite se Aproximando" },
    info: { icon: CheckCircle2, variant: "default" as const, title: "Status do Limite MEI" }
  };

  const currentAlert = summary ? alertConfig[summary.alertLevel] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="Gestão MEI / Negócio" 
        description={`Visão operacional e controle de limite anual — Ano ${currentYear}`}
      >
        <Badge variant="outline" className="gap-1.5 py-1 px-3">
          <Briefcase className="h-3.5 w-3.5" />
          Escopo Business Ativo
        </Badge>
      </PageHeader>

      {/* Alertas de Limite */}
      {summary && summary.alertLevel !== "info" && (
        <Alert variant={currentAlert?.variant}>
          <currentAlert.icon className="h-4 w-4" />
          <AlertTitle>{currentAlert?.title}</AlertTitle>
          <AlertDescription>
            Você já utilizou **{formatPercent(summary.percentualLimite)}** do seu limite anual de {formatCurrency(summary.limiteAnual)}. 
            Restam apenas **{formatCurrency(summary.valorRestanteLimite)}** para faturar este ano sem desenquadrar do MEI.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Receita Bruta (Ano)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary?.receitaBruta || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Faturamento total acumulado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Custos Diretos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary?.custosOperacionais || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Insumos e mercadorias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Lucro Operacional</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(summary?.lucroOperacional || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              Margem de {formatPercent(summary?.margemLucro || 0)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Limite Utilizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(summary?.percentualLimite || 0)}</div>
            <Progress value={summary?.percentualLimite} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Detalhamento do Limite */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Controle do Teto MEI
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Faturamento Atual</span>
                <span className="font-medium">{formatCurrency(summary?.receitaBruta || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Limite Disponível</span>
                <span className="font-medium text-green-600">{formatCurrency(summary?.valorRestanteLimite || 0)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t">
                <span className="font-semibold">Teto Anual</span>
                <span className="font-semibold">{formatCurrency(summary?.limiteAnual || 81000)}</span>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Projeção de Segurança</h4>
              <p className="text-sm leading-relaxed">
                Com base no faturamento atual, você pode faturar em média 
                <span className="font-bold"> {formatCurrency((summary?.valorRestanteLimite || 0) / (12 - new Date().getMonth()))}</span> por mês até o fim do ano para se manter no limite.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Resumo Financeiro Business */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Resultado Operacional Business
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Receitas (+)</span>
                  <span className="text-xl font-bold text-green-600">{formatCurrency(summary?.receitaBruta || 0)}</span>
                </div>
                <div className="p-4 border rounded-lg">
                  <span className="text-xs text-muted-foreground block mb-1">Custos e Despesas (-)</span>
                  <span className="text-xl font-bold text-red-600">{formatCurrency((summary?.custosOperacionais || 0) + (summary?.despesasIndiretas || 0))}</span>
                </div>
              </div>

              <div className="bg-primary/5 p-6 rounded-xl border border-primary/10 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h3 className="text-lg font-bold">Lucro Líquido Business</h3>
                  <p className="text-sm text-muted-foreground">Resultado real do seu negócio após todos os gastos operacionais.</p>
                </div>
                <div className="text-3xl font-black text-primary">
                  {formatCurrency(summary?.lucroOperacional || 0)}
                </div>
              </div>

              <div className="pt-4">
                <h4 className="text-sm font-semibold mb-3">Distribuição de Gastos</h4>
                <div className="flex h-4 w-full rounded-full overflow-hidden bg-muted">
                  <div 
                    className="bg-orange-500 h-full" 
                    style={{ width: `${summary && (summary.custosOperacionais + summary.despesasIndiretas) > 0 ? (summary.custosOperacionais / (summary.custosOperacionais + summary.despesasIndiretas)) * 100 : 50}%` }}
                    title="Custos Operacionais"
                  />
                  <div 
                    className="bg-red-400 h-full" 
                    style={{ width: `${summary && (summary.custosOperacionais + summary.despesasIndiretas) > 0 ? (summary.despesasIndiretas / (summary.custosOperacionais + summary.despesasIndiretas)) * 100 : 50}%` }}
                    title="Despesas Indiretas"
                  />
                </div>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-orange-500" />
                    <span>Custos Diretos ({formatCurrency(summary?.custosOperacionais || 0)})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span>Despesas Indiretas ({formatCurrency(summary?.despesasIndiretas || 0)})</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
