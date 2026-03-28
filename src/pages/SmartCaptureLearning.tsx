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
import { 
  Brain, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Search,
  ArrowRight,
  Filter,
  RefreshCcw,
  MessageSquare
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export default function SmartCaptureLearning() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: records, isLoading, refetch } = useQuery({
    queryKey: ["smart_capture_learning"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("smart_capture_learning")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LearningRecord[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'good' | 'bad' | 'later' }) => {
      const { error } = await supabase
        .from("smart_capture_learning")
        .update({ review_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["smart_capture_learning"] });
      toast.success("Status atualizado com sucesso");
    },
  });

  const filteredRecords = useMemo(() => {
    if (!records) return [];
    return records.filter(r => {
      const matchesType = filterType === "all" || r.source_type === filterType;
      const matchesConfidence = filterConfidence === "all" || r.confidence_before === filterConfidence;
      const matchesSearch = !searchTerm || 
        r.source_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.normalized_text?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesConfidence && matchesSearch;
    });
  }, [records, filterType, filterConfidence, searchTerm]);

  const metrics = useMemo(() => {
    if (!records || records.length === 0) return null;

    const total = records.length;
    let corrections = {
      amount: 0,
      type: 0,
      description: 0,
      category: 0,
      scope: 0
    };

    records.forEach(r => {
      const sug = r.suggested_payload || {};
      const fin = r.final_payload || {};

      if (Number(sug.amount) !== Number(fin.amount)) corrections.amount++;
      if (sug.type !== fin.type) corrections.type++;
      if (sug.description !== fin.description) corrections.description++;
      if (sug.category_id !== fin.category_id) corrections.category++;
      if (sug.scope !== fin.scope) corrections.scope++;
    });

    return {
      total,
      corrections,
      accuracy: {
        amount: ((total - corrections.amount) / total * 100).toFixed(1),
        type: ((total - corrections.type) / total * 100).toFixed(1),
        description: ((total - corrections.description) / total * 100).toFixed(1),
        category: ((total - corrections.category) / total * 100).toFixed(1),
        scope: ((total - corrections.scope) / total * 100).toFixed(1),
      }
    };
  }, [records]);

  const getConfidenceBadge = (conf: string) => {
    switch (conf) {
      case 'high': return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Alta</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Média</Badge>;
      case 'low': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Baixa</Badge>;
      default: return <Badge variant="outline">{conf}</Badge>;
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'good': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'bad': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'later': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return null;
    }
  };

  const renderComparison = (sug: any, fin: any, field: string, label: string) => {
    const isDifferent = sug[field] !== fin[field];
    return (
      <div className="flex flex-col gap-1 py-1 border-b border-border/50 last:border-0">
        <span className="text-[10px] uppercase font-bold text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground line-through decoration-red-500/30">{String(sug[field] || '-')}</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
          <span className={isDifferent ? "text-primary font-medium" : "text-foreground"}>
            {String(fin[field] || '-')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <PageHeader 
        title="Curadoria de Aprendizado" 
        description="Analise e melhore a inteligência da Captura Inteligente"
        icon={Brain}
      />

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard title="Total de Registros" value={metrics.total} icon={Brain} />
          <KpiCard 
            title="Precisão Valor" 
            value={`${metrics.accuracy.amount}%`} 
            description={`${metrics.corrections.amount} correções`}
            trend={Number(metrics.accuracy.amount) > 80 ? "up" : "down"}
          />
          <KpiCard 
            title="Precisão Categoria" 
            value={`${metrics.accuracy.category}%`} 
            description={`${metrics.corrections.category} correções`}
          />
          <KpiCard 
            title="Precisão Tipo" 
            value={`${metrics.accuracy.type}%`} 
            description={`${metrics.corrections.type} correções`}
          />
          <KpiCard 
            title="Precisão Escopo" 
            value={`${metrics.accuracy.scope}%`} 
            description={`${metrics.corrections.scope} correções`}
          />
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 space-y-2">
          <label className="text-xs font-medium text-muted-foreground ml-1">Buscar texto</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar em texto original ou normalizado..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="w-full md:w-48 space-y-2">
          <label className="text-xs font-medium text-muted-foreground ml-1">Origem</label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="voice">Voz</SelectItem>
              <SelectItem value="photo_ocr">Foto / OCR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full md:w-48 space-y-2">
          <label className="text-xs font-medium text-muted-foreground ml-1">Confiança</label>
          <Select value={filterConfidence} onValueChange={setFilterConfidence}>
            <SelectTrigger>
              <SelectValue placeholder="Confiança" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()} className="shrink-0">
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-medium">Registros de Captura</CardTitle>
          <Badge variant="secondary">{filteredRecords.length} encontrados</Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Data/Hora</TableHead>
                  <TableHead className="w-[100px]">Origem</TableHead>
                  <TableHead>Texto Capturado</TableHead>
                  <TableHead className="w-[100px]">Confiança</TableHead>
                  <TableHead className="w-[250px]">Divergências (Sugerido → Final)</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">Carregando registros...</TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum registro encontrado</TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((record) => (
                    <TableRow key={record.id} className="group">
                      <TableCell className="text-xs font-mono">
                        {format(new Date(record.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {record.source_type === 'photo_ocr' ? 'Foto' : 'Voz'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 max-w-[300px]">
                          <span className="text-xs line-clamp-2 font-medium">{record.source_text}</span>
                          {record.normalized_text && (
                            <span className="text-[10px] text-muted-foreground italic line-clamp-1">
                              "{record.normalized_text}"
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getConfidenceBadge(record.confidence_before)}
                      </TableCell>
                      <TableCell>
                        <div className="grid grid-cols-1 gap-0.5">
                          {renderComparison(record.suggested_payload, record.final_payload, 'amount', 'Valor')}
                          {renderComparison(record.suggested_payload, record.final_payload, 'category_id', 'Categoria')}
                          {renderComparison(record.suggested_payload, record.final_payload, 'type', 'Tipo')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${record.review_status === 'good' ? 'bg-green-500/10 text-green-500' : ''}`}
                            onClick={() => updateStatusMutation.mutate({ id: record.id, status: 'good' })}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${record.review_status === 'bad' ? 'bg-red-500/10 text-red-500' : ''}`}
                            onClick={() => updateStatusMutation.mutate({ id: record.id, status: 'bad' })}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${record.review_status === 'later' ? 'bg-yellow-500/10 text-yellow-500' : ''}`}
                            onClick={() => updateStatusMutation.mutate({ id: record.id, status: 'later' })}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="mt-1 flex justify-end">
                          {getStatusIcon(record.review_status)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
