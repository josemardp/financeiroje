import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Heart } from "lucide-react";

export default function FamilyValues() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Valores Familiares" description="O que nunca deve ser cortado" />
      <EmptyState
        icon={Heart}
        title="Valores da família"
        description="Cadastre o que importa: pizza às sextas, lazer com a Melinda. A IA respeita esses princípios."
      />
    </div>
  );
}
