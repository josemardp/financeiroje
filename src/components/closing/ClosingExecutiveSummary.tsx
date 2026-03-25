import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import type { MonthlySummary } from "@/services/financeEngine/types";
import type { ExecutiveSummary } from "@/services/closingAnalysis";

const verdictConfig = {
  positivo: { icon: TrendingUp, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success)/0.1)]", badge: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" },
  neutro: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted", badge: "bg-muted text-muted-foreground" },
  atencao: { icon: AlertTriangle, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning)/0.1)]", badge: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]" },
  pressao: { icon: TrendingDown, color: "text-destructive", bg: "bg-destructive/10", badge: "bg-destructive text-destructive-foreground" },
};

interface Props {
  summary: MonthlySummary;
  executive: ExecutiveSummary;
}

export function ClosingExecutiveSummary({ summary, executive }: Props) {
  const config = verdictConfig[executive.verdict];
  const Icon = config.icon;

  return (
    <div className="space-y-4">
      {/* Verdict banner */}
      <Card className={config.bg}>
        <CardContent className="p-4 flex items-center gap-3">
          <Icon className={`h-5 w-5 ${config.color} shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={config.badge}>{executive.verdictLabel}</Badge>
              {executive.savingsRate !== 0 && (
                <span className="text-xs text-muted-foreground">
                  Taxa de poupança: {executive.savingsRate.toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-sm mt-1 text-foreground/80">{executive.verdictDescription}</p>
          </div>
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid gap-3 grid-cols-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Receitas</p>
            <p className="text-lg font-bold font-mono text-[hsl(var(--success))]">{formatCurrency(summary.totalIncome)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Despesas</p>
            <p className="text-lg font-bold font-mono text-destructive">{formatCurrency(summary.totalExpense)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Saldo</p>
            <p className={`text-lg font-bold font-mono ${summary.balance >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
              {formatCurrency(summary.balance)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
