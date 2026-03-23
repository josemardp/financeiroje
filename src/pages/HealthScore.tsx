import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { BarChart3 } from "lucide-react";

export default function HealthScore() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Score de Saúde Financeira" description="Nota calculada deterministicamente" />
      <EmptyState
        icon={BarChart3}
        title="Score financeiro"
        description="Comprometimento da renda, reserva, controle orçamentário, adimplência e regularidade."
      />
    </div>
  );
}
