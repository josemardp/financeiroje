import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Target } from "lucide-react";

export default function Goals() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Metas & Sonhos" description="Mural visual dos seus objetivos financeiros" />
      <EmptyState
        icon={Target}
        title="Mural dos Sonhos"
        description="Cadastre seus sonhos e metas financeiras com prazo, prioridade e acompanhe o progresso visualmente."
      />
    </div>
  );
}
