import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { ReliabilityResult } from "@/services/closingAnalysis";

const config = {
  confiavel: { icon: ShieldCheck, color: "text-[hsl(var(--success))]", badge: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" },
  parcial: { icon: ShieldAlert, color: "text-[hsl(var(--warning))]", badge: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]" },
  baixa: { icon: ShieldX, color: "text-destructive", badge: "bg-destructive text-destructive-foreground" },
};

interface Props {
  reliability: ReliabilityResult;
}

export function ClosingReliability({ reliability }: Props) {
  const c = config[reliability.level];
  const Icon = c.icon;

  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${c.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={c.badge}>{reliability.label}</Badge>
            <span className="text-xs text-muted-foreground">
              {reliability.totalTransactions} transações
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{reliability.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
