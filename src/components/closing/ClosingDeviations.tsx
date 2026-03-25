import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import type { MonthDeviation } from "@/services/closingAnalysis";

const severityConfig = {
  critical: { icon: AlertTriangle, color: "text-destructive", border: "border-destructive/30" },
  warning: { icon: AlertCircle, color: "text-[hsl(var(--warning))]", border: "border-[hsl(var(--warning)/0.3)]" },
  info: { icon: Info, color: "text-muted-foreground", border: "border-border" },
};

interface Props {
  deviations: MonthDeviation[];
}

export function ClosingDeviations({ deviations }: Props) {
  if (deviations.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Principais Desvios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {deviations.map((d, i) => {
          const config = severityConfig[d.severity];
          const Icon = config.icon;
          return (
            <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${config.border} bg-card`}>
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-muted-foreground">{d.detail}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
