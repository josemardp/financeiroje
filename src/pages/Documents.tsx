import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText } from "lucide-react";

export default function Documents() {
  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Documentos / IR" description="Cofre de documentos e módulo fiscal" />
      <EmptyState
        icon={FileText}
        title="Cofre de documentos"
        description="Armazene contracheques, recibos médicos e comprovantes de educação para o IRPF."
      />
    </div>
  );
}
