import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CreditCard } from "lucide-react";

export default function Loans() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dívidas" description="Gestão de empréstimos e simulador de amortização" />
      <EmptyState
        icon={CreditCard}
        title="Gestão de dívidas"
        description="Cadastre seus empréstimos para acompanhar saldo devedor, juros e simular estratégias de quitação."
      />
    </div>
  );
}
