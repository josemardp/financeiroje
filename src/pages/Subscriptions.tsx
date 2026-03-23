import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Wallet } from "lucide-react";

export default function Subscriptions() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Assinaturas" description="Pagamentos recorrentes e vazamentos financeiros" />
      <EmptyState
        icon={Wallet}
        title="Assinaturas ativas"
        description="Acompanhe Netflix, Spotify, planos e identifique oportunidades de economia."
      />
    </div>
  );
}
