import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Plus, FileText, Loader2, Trash2, Upload, Download } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

const DOC_TYPE_LABELS: Record<string, string> = {
  contracheque: "Contracheque",
  recibo_medico: "Recibo Médico",
  recibo_educacao: "Recibo Educação",
  informe_rendimentos: "Informe de Rendimentos",
  das_mei: "DAS MEI",
  nota_fiscal: "Nota Fiscal",
  comprovante: "Comprovante",
  outro: "Outro",
};

export default function Documents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", filterType, filterYear],
    queryFn: async () => {
      let query = supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (filterType !== "all") query = query.eq("document_type", filterType as Database["public"]["Enums"]["document_type"]);
      if (filterYear !== "all") query = query.eq("ano_fiscal", Number(filterYear));
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: DocumentRow) => {
      // Delete DB record first — this is the source of truth
      const { error: dbError } = await supabase.from("documents").delete().eq("id", doc.id);
      if (dbError) throw dbError;

      // Then remove storage — orphan file is less critical than broken reference
      if (doc.file_url) {
        const storagePath = doc.file_url.startsWith("http")
          ? `${user!.id}/${doc.file_url.split("/").pop()}`
          : doc.file_url;
        // Fire and forget — storage cleanup failure doesn't block the operation
        supabase.storage.from("documents").remove([storagePath]).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Documento removido");
    },
    onError: (err: any) => {
      toast.error("Erro ao remover documento", { description: err.message });
    },
  });

  /** Open a signed URL for private document viewing (5 min expiry) */
  const handleViewDocument = async (doc: DocumentRow) => {
    if (!doc.file_url) return;
    const storagePath = doc.file_url.startsWith("http")
      ? `${user!.id}/${doc.file_url.split("/").pop()}`
      : doc.file_url;
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(storagePath, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    } else {
      toast.error("Erro ao gerar link seguro", { description: error?.message });
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Documentos / IR" description="Cofre de documentos e módulo fiscal">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo documento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Documento</DialogTitle></DialogHeader>
            <DocumentForm onSuccess={() => { setIsOpen(false); queryClient.invalidateQueries({ queryKey: ["documents"] }); }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !documents || documents.length === 0 ? (
        <EmptyState icon={FileText} title="Sem documentos" description="Armazene recibos, comprovantes e documentos fiscais.">
          <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {documents.map((doc: DocumentRow) => (
              <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{DOC_TYPE_LABELS[doc.document_type] || "Outro"}</Badge>
                      {doc.ano_fiscal && <span className="text-xs text-muted-foreground">Ano: {doc.ano_fiscal}</span>}
                      {doc.holder && <span className="text-xs text-muted-foreground">• {doc.holder}</span>}
                      <span className="text-xs text-muted-foreground">• {formatDate(doc.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={doc.linked_entity_id ? "default" : "secondary"} className="text-[10px]">
                    {doc.linked_entity_id ? "Vinculado" : "Sem vínculo"}
                  </Badge>
                  {doc.file_url && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary"
                      title="Visualizar documento (link seguro temporário)"
                      onClick={() => handleViewDocument(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DocumentForm({ onSuccess }: { onSuccess: () => void }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    document_type: "outro",
    ano_fiscal: String(new Date().getFullYear()),
    holder: "",
    category: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !file) { toast.error("Selecione um arquivo"); return; }
    setSubmitting(true);

    const filePath = `${user.id}/${Date.now()}_${file.name}`;

    try {
      // 1. Upload to private bucket
      const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
      if (uploadError) {
        toast.error("Erro no upload", { description: uploadError.message });
        setSubmitting(false);
        return;
      }

      // 2. Insert DB record — rollback storage if this fails
      const { error } = await supabase.from("documents").insert({
        user_id: user.id,
        file_name: file.name,
        file_url: filePath,
        document_type: form.document_type as Database["public"]["Enums"]["document_type"],
        ano_fiscal: Number(form.ano_fiscal) || null,
        holder: form.holder || null,
        category: form.category || null,
      });

      if (error) {
        // Rollback: remove orphan file
        await supabase.storage.from("documents").remove([filePath]);
        toast.error("Erro ao salvar documento", { description: error.message });
      } else {
        toast.success("Documento salvo!");
        onSuccess();
      }
    } catch (err) {
      // Rollback on unexpected error
      await supabase.storage.from("documents").remove([filePath]).catch(() => {});
      toast.error("Erro inesperado ao salvar documento");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Arquivo</Label>
        <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo</Label>
          <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ano fiscal</Label>
          <Input type="number" min="2020" max="2030" value={form.ano_fiscal}
            onChange={e => setForm(f => ({ ...f, ano_fiscal: e.target.value }))} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Titular</Label>
        <Input placeholder="Nome do titular" value={form.holder}
          onChange={e => setForm(f => ({ ...f, holder: e.target.value }))} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        <Upload className="h-4 w-4 mr-1" /> Salvar documento
      </Button>
    </form>
  );
}
