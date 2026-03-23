import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bell } from "lucide-react";

export default function Alerts() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Alertas" description="Centro de notificações e oportunidades" />
      <EmptyState
        icon={Bell}
        title="Centro de alertas"
        description="Vencimentos, gastos anormais, oportunidades de economia e sugestões da IA."
      />
    </div>
  );
}
