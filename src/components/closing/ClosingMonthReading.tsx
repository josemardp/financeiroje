import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp, Eye, Flame } from "lucide-react";
import type { MonthReading } from "@/services/closingAnalysis";

interface Props {
  reading: MonthReading;
}

export function ClosingMonthReading({ reading }: Props) {
  const items = [
    { icon: ThumbsUp, label: "Ponto positivo", text: reading.positivePoint, color: "text-[hsl(var(--success))]" },
    { icon: Eye, label: "Atenção", text: reading.attentionPoint, color: "text-[hsl(var(--warning))]" },
    { icon: Flame, label: "Maior pressão", text: reading.biggestPressure, color: "text-destructive" },
  ].filter(i => i.text);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Leitura do Mês</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <item.icon className={`h-4 w-4 mt-0.5 shrink-0 ${item.color}`} />
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase">{item.label}</p>
              <p className="text-sm">{item.text}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
