import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Bot } from "lucide-react";

export default function AiAdvisor() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="IA Conselheira" description="Assistente financeiro com protocolo zero-alucinação" />
      <EmptyState
        icon={Bot}
        title="Conselheiro financeiro com IA"
        description="Faça perguntas sobre suas finanças. A IA responde com base nos seus dados reais — nunca inventa."
      />
    </div>
  );
}
