import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { TrendingUp } from "lucide-react";

export default function Forecast() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Previsão de Caixa" description="Projeção de 7, 30 e 90 dias" />
      <EmptyState
        icon={TrendingUp}
        title="Previsão de caixa"
        description="Baseada nas recorrências e padrões históricos — sempre rotulada como [PROJEÇÃO]."
      />
    </div>
  );
}
