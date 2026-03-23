import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Configurações" description="Categorias, preferências e dados" />
      <EmptyState
        icon={Settings}
        title="Configurações do sistema"
        description="Gerencie categorias, limites orçamentários, preferências de IA e exportação de dados."
      />
    </div>
  );
}
