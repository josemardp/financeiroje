import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, ChevronRight } from "lucide-react";
import type { NextMonthFocus } from "@/services/closingAnalysis";

interface Props {
  focus: NextMonthFocus;
}

export function ClosingNextFocus({ focus }: Props) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Foco do Próximo Mês</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-sm font-medium">{focus.primary}</p>
        </div>
        {focus.secondary.length > 0 && (
          <div className="space-y-1.5">
            {focus.secondary.map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{s}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
