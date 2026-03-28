import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Brain, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search,
  ArrowRight,
  RefreshCcw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { normalizeConfidence, detectDivergence, calculateAccuracy } from "@/lib/learningUtils";

interface LearningRecord {
  id: string;
  created_at: string;
  source_type: string;
  source_text: string;
  normalized_text: string;
  suggested_payload: any;
  final_payload: any;
  confidence_before: string;
  category_id: string;
  transaction_type: string;
  scope: string;
  review_status: 'good' | 'bad' | 'later' | null;
  review_notes: string | null;
}

const ITEMS_PER_PAGE = 10;

export default function SmartCaptureLearning() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [filterCorrection, setFilterCorrection] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const { data: records, isLoading, refetch } = useQuery({
    queryKey: ["smart_capture_learning"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("smart_capture_learning")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as LearningRecord[];
    },
  });

  const updateRecordMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status?: 'good' | 'bad' | 'later'; notes?: string }) => {
      const updates: any = {};
      if (status) updates.review_status = status;
      if (notes !== undefined) updates.review_notes = notes;
      
      const { error } = await (supabase as any)
        .from("smart_capture_learning")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart_capture_learning"] });
      toast.success("Registro atualizado com sucesso");
    },
  });

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    return records.filter(r => {
      const normalizedConf = normalizeConfidence(r.confidence_before);
      const matchesType = filterType === "all" || r.source_type === filterType;
      const matchesConfidence = filterConfidence === "all" || normalizedConf === filterConfidence;
      const matchesSearch = !searchTerm || 
        r.source_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.normalized_text?.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesCorrection = true;
      if (filterCorrection !== "all") {
        const sug = r.suggested_payload || {};
        const fin = r.final_payload || {};
        if (filterCorrection === "amount") matchesCorrection = detectDivergence(sug, fin, 'amount');
        if (filterCorrection === "type") matchesCorrection = detectDivergence(sug, fin, 'type');
        if (filterCorrection === "description") matchesCorrection = detectDivergence(sug, fin, 'description');
        if (filterCorrection === "category") matchesCorrection = detectDivergence(sug, fin, 'category_id');
        if (filterCorrection === "scope") matchesCorrection = detectDivergence(sug, fin, 'scope');
      }

      return matchesType && matchesConfidence && matchesSearch && matchesCorrection;
    });
  }, [records, filterType, filterConfidence, filterCorrection, searchTerm]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const metrics = useMemo(() => calculateAccuracy(records || []), [records]);

  const getConfidenceBadge = (conf: string) => {
    const normalized = normalizeConfidence(conf);
    switch (normalized) {
      case 'alta': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Alta</Badge>;
      case 'media': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Média</Badge>;
      case 'baixa': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Baixa</Badge>;
      default: return <Badge variant="outline">{conf}</Badge>;
    }
  };

  const renderComparison = (sug: any, fin: any, field: string, label: string) => {
    const valSug = field === 'amount' ? Number(sug[field] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(sug[field] || '-');
    const valFin = field === 'amount' ? Number(fin[field] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : String(fin[field] || '-');
    const isDifferent = detectDivergence(sug, fin, field);
    
    return (
      <div className="flex flex-col gap-0.5 py-1 border-b border-border/50 last:border-0">
        <span className="text-[9px] uppercase font-bold text-muted-foreground/70">{label}</span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-muted-foreground/60 line-through decoration-red-500/20 truncate max-w-[80px]">{valSug}</span>
          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />
          <span className={isDifferent ? "text-primary font-semibold" : "text-foreground/80"}>{valFin}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-6 animate-in fade-in duration-500">
      <PageHeader title="Curadoria de IA" description="Refinamento e monitoramento da inteligência de captura" />

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard title="Total" value={String(metrics.total)} icon={Brain} />
          <KpiCard title="Valor" value={`${metrics.accuracy.amount}%`} icon={Brain} subtitle={`${metrics.corrections.amount} corr.`} />
          <KpiCard title="Categoria" value={`${metrics.accuracy.category}%`} icon={Brain} subtitle={`${metrics.corrections.category} corr.`} />
          <KpiCard title="Tipo" value={`${metrics.accuracy.type}%`} icon={Brain} subtitle={`${metrics.corrections.type} corr.`} />
          <KpiCard title="Descrição" value={`${metrics.accuracy.description}%`} icon={Brain} subtitle={`${metrics.corrections.description} corr.`} />
          <KpiCard title="Escopo" value={`${metrics.accuracy.scope}%`} icon={Brain} subtitle={`${metrics.corrections.scope} corr.`} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-end bg-muted/30 p-4 rounded-lg border border-border/50">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Busca</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Texto original ou normalizado..." className="pl-9 h-9 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="w-32 space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Origem</label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="voice">Voz</SelectItem>
              <SelectItem value="photo_ocr">Foto / OCR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-32 space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Confiança</label>
          <Select value={filterConfidence} onValueChange={setFilterConfidence}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Confiança" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
              <SelectItem value="media">Média</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-40 space-y-1.5">
          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Correção em</label>
          <Select value={filterCorrection} onValueChange={setFilterCorrection}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Campo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Qualquer campo</SelectItem>
              <SelectItem value="amount">Valor</SelectItem>
              <SelectItem value="type">Tipo</SelectItem>
              <SelectItem value="description">Descrição</SelectItem>
              <SelectItem value="category">Categoria</SelectItem>
              <SelectItem value="scope">Escopo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="h-9 w-9 shrink-0"><RefreshCcw className="h-4 w-4" /></Button>
      </div>

      <Card className="border-border/40 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[120px] text-[10px] uppercase font-bold">Data/Origem</TableHead>
                <TableHead className="text-[10px] uppercase font-bold">Captura</TableHead>
                <TableHead className="w-[220px] text-[10px] uppercase font-bold">Divergências</TableHead>
                <TableHead className="w-[200px] text-[10px] uppercase font-bold">Notas de Revisão</TableHead>
                <TableHead className="w-[120px] text-right text-[10px] uppercase font-bold">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : paginatedRecords.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
              ) : (
                paginatedRecords.map((record) => (
                  <TableRow key={record.id} className="group hover:bg-muted/20 transition-colors border-b border-border/40">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-muted-foreground">{format(new Date(record.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        <div className="flex gap-1 items-center">
                          <Badge variant="outline" className="text-[9px] h-4 px-1">{record.source_type === 'photo_ocr' ? 'Foto' : 'Voz'}</Badge>
                          {getConfidenceBadge(record.confidence_before)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 max-w-[350px]">
                        <span className="text-xs font-medium line-clamp-2 leading-relaxed">{record.source_text}</span>
                        {record.normalized_text && <span className="text-[10px] text-muted-foreground italic line-clamp-1">"{record.normalized_text}"</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="grid grid-cols-1 gap-0 bg-muted/20 p-1.5 rounded border border-border/30">
                        {renderComparison(record.suggested_payload, record.final_payload, 'amount', 'Valor')}
                        {renderComparison(record.suggested_payload, record.final_payload, 'type', 'Tipo')}
                        {renderComparison(record.suggested_payload, record.final_payload, 'description', 'Descrição')}
                        {renderComparison(record.suggested_payload, record.final_payload, 'category_id', 'Categoria')}
                        {renderComparison(record.suggested_payload, record.final_payload, 'scope', 'Escopo')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <Textarea 
                          className="text-[11px] min-h-[60px] resize-none bg-transparent border-transparent hover:border-border focus:border-primary transition-all p-1"
                          placeholder="Adicionar observação..."
                          defaultValue={record.review_notes || ""}
                          onBlur={(e) => {
                            if (e.target.value !== (record.review_notes || "")) {
                              updateRecordMutation.mutate({ id: record.id, notes: e.target.value });
                            }
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${record.review_status === 'good' ? 'bg-green-500/10 text-green-500' : ''}`} onClick={() => updateRecordMutation.mutate({ id: record.id, status: 'good' })}><CheckCircle2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${record.review_status === 'bad' ? 'bg-red-500/10 text-red-500' : ''}`} onClick={() => updateRecordMutation.mutate({ id: record.id, status: 'bad' })}><XCircle className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 ${record.review_status === 'later' ? 'bg-yellow-500/10 text-yellow-500' : ''}`} onClick={() => updateRecordMutation.mutate({ id: record.id, status: 'later' })}><Clock className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border/40">
              <span className="text-xs text-muted-foreground">Página {currentPage} de {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 gap-1"><ChevronLeft className="h-3.5 w-3.5" /> Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 gap-1">Próximo <ChevronRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
