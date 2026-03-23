import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { CalendarDays } from "lucide-react";

export default function Recurring() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Recorrências" description="Receitas e despesas fixas mensais" />
      <EmptyState
        icon={CalendarDays}
        title="Transações recorrentes"
        description="Cadastre salários, contas fixas e parcelas para alimentar a previsão de caixa automaticamente."
      />
    </div>
  );
}
