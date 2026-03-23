import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { PiggyBank } from "lucide-react";

export default function Budget() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Orçamento" description="Planejado vs realizado por categoria" />
      <EmptyState
        icon={PiggyBank}
        title="Orçamento mensal"
        description="Configure seus limites de gasto por categoria para acompanhar o realizado vs planejado."
      />
    </div>
  );
}
