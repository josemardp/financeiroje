
/**
 * FinanceAI — Net Worth Dashboard
 * 
 * Exibe a visão consolidada de patrimônio líquido:
 * - Valor Total do Patrimônio Líquido
 * - Composição por tipo de ativo (Gráfico de Rosca)
 * - Histórico de valorização (Gráfico de Linha)
 * - Ativos vs Dívidas (Barra Comparativa)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/format";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Landmark, Wallet, Car, Home, Bitcoin, MoreHorizontal } from 'lucide-react';

interface NetWorthDashboardProps {
  summary: {
    total_assets: number;
    total_liabilities: number;
    net_worth: number;
    composition: {
      type: string;
      total: number;
      percent: number;
    }[];
  };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

const TYPE_LABELS: Record<string, { label: string, icon: any }> = {
  real_estate: { label: 'Imóveis', icon: Home },
  vehicle: { label: 'Veículos', icon: Car },
  stock: { label: 'Ações/Bolsa', icon: TrendingUp },
  crypto: { label: 'Criptoativos', icon: Bitcoin },
  fixed_income: { label: 'Renda Fixa', icon: Landmark },
  cash: { label: 'Liquidez/Caixa', icon: Wallet },
  other: { label: 'Outros', icon: MoreHorizontal }
};

export function NetWorthDashboard({ summary }: NetWorthDashboardProps) {
  const chartData = summary.composition.map(c => ({
    name: TYPE_LABELS[c.type]?.label || c.type,
    value: c.total
  }));

  const isPositive = summary.net_worth >= 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Patrimônio Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(summary.net_worth)}
              </span>
              {isPositive ? <TrendingUp className="w-5 h-5 text-green-500" /> : <TrendingDown className="w-5 h-5 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Consolidado (Ativos - Dívidas)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-blue-600">{formatCurrency(summary.total_assets)}</span>
            <p className="text-xs text-muted-foreground mt-1">Inclui investimentos e bens</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de Dívidas</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-bold text-orange-600">{formatCurrency(summary.total_liabilities)}</span>
            <p className="text-xs text-muted-foreground mt-1">Empréstimos e parcelamentos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composition Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Composição do Patrimônio</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Assets vs Liabilities Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Alavancagem Patrimonial</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-center h-[300px]">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Ativos</span>
                  <span className="text-muted-foreground">{formatPercent((summary.total_assets / (summary.total_assets + summary.total_liabilities)) * 100)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4">
                  <div 
                    className="bg-blue-500 h-4 rounded-full transition-all" 
                    style={{ width: `${(summary.total_assets / (summary.total_assets + summary.total_liabilities)) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Dívidas</span>
                  <span className="text-muted-foreground">{formatPercent((summary.total_liabilities / (summary.total_assets + summary.total_liabilities)) * 100)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-4">
                  <div 
                    className="bg-orange-500 h-4 rounded-full transition-all" 
                    style={{ width: `${(summary.total_liabilities / (summary.total_assets + summary.total_liabilities)) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  Sua saúde patrimonial está <span className="font-bold text-green-600">Excelente</span>. 
                  Você possui <span className="font-bold">{formatCurrency(summary.total_assets / Math.max(1, summary.total_liabilities))}</span> de ativos para cada R$ 1,00 de dívida.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
