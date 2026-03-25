/**
 * FinanceAI — Captura Inteligente Premium (Sprint 3)
 * Modo Espelho: Texto Livre, Voz e OCR → Parser → Confirmação → Persistência
 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseTransactionText, type ParsedTransaction } from "@/services/smartCapture";
import { useVoiceCapture } from "@/services/smartCapture/hooks/useVoiceCapture";
import { useOcrCapture } from "@/services/smartCapture/hooks/useOcrCapture";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataStatusBadge } from "@/components/shared/DataStatusBadge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { 
  Mic, Camera, Type, Send, Check, X, Edit, AlertCircle, 
  Loader2, Trash2, Save, FileText, Image as ImageIcon, Sparkles
} from "lucide-react";

type CaptureMode = "text" | "voice" | "photo";

export default function SmartCapture() {
  const { user } = useAuth();
  const { currentScope, scopeLabel } = useScope();
  const queryClient = useQueryClient();
  
  const [mode, setMode] = useState<CaptureMode>("text");
  const [textInput, setTextInput] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Custom hooks for Voice and OCR
  const { isRecording, isTranscribing, result: voiceResult, startRecording, stopRecording, resetVoice } = useVoiceCapture();
  const { isProcessing: isOcrProcessing, result: ocrResult, processImage, resetOcr } = useOcrCapture();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Editable fields for mirror mode
  const [editForm, setEditForm] = useState({
    valor: "",
    tipo: "expense" as string,
    descricao: "",
    data: "",
    categoria_id: "",
    scope: "private",
    source_type: "free_text",
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("nome");
      return data || [];
    },
  });

  // Handle transcription result
  useEffect(() => {
    if (voiceResult) {
      setTextInput(voiceResult.text);
      handleParse(voiceResult.text, "voice");
      resetVoice();
    }
  }, [voiceResult]);

  // Handle OCR result
  useEffect(() => {
    if (ocrResult) {
      handleParse(ocrResult.text, "ocr");
      resetOcr();
    }
  }, [ocrResult]);

  const handleParse = (input: string, source: string = "free_text") => {
    const textToParse = input || textInput;
    if (!textToParse.trim()) return;
    
    const result = parseTransactionText(textToParse);
    setParsed(result);
    setIsEditing(false);
    
    // Initialize form with parsed data and respect current global scope
    setEditForm({
      valor: result.valor?.toString() || "",
      tipo: result.tipo,
      descricao: result.descricao,
      data: result.data,
      categoria_id: "",
      scope: currentScope === "all" ? result.escopo : currentScope,
      source_type: source,
    });

    // Try to match suggested category
    if (result.categoriaSugerida && categories) {
      const match = categories.find((c: any) =>
        c.nome.toLowerCase().includes(result.categoriaSugerida!.toLowerCase())
      );
      if (match) {
        setEditForm(f => ({ ...f, categoria_id: match.id }));
      }
    }
    
    toast.success("Dados extraídos com sucesso!", {
      description: "Revise no Modo Espelho abaixo."
    });
  };

  const handleSave = async () => {
    if (!user || !editForm.valor || Number(editForm.valor) <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setIsSaving(true);

    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      valor: Number(editForm.valor),
      tipo: editForm.tipo as any,
      categoria_id: editForm.categoria_id || null,
      descricao: editForm.descricao,
      data: editForm.data,
      scope: editForm.scope as any,
      data_status: "suggested" as any,
      source_type: editForm.source_type as any,
      confidence: parsed?.confianca as any || "media",
      created_by: user.id,
      validation_notes: `Texto original: "${parsed?.textoOriginal || textInput}"`,
    });

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Transação registrada como sugerida", {
        description: `Salva no escopo: ${editForm.scope === 'private' ? 'Pessoal' : editForm.scope === 'family' ? 'Família' : 'Negócio'}.`,
      });
      setParsed(null);
      setTextInput("");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
    }
    setIsSaving(false);
  };

  const handleDiscard = () => {
    setParsed(null);
    setTextInput("");
    toast.info("Captura descartada");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Captura Inteligente Premium"
        description={`Modo Espelho ativo — Escopo atual: ${scopeLabel}`}
      />

      {/* Mode selector */}
      <div className="flex flex-wrap gap-2">
        <Button 
          variant={mode === "text" ? "default" : "outline"} 
          size="sm" 
          onClick={() => setMode("text")}
          className="transition-all"
        >
          <Type className="h-4 w-4 mr-2" /> Texto Livre
        </Button>
        <Button 
          variant={mode === "voice" ? "default" : "outline"} 
          size="sm" 
          onClick={() => setMode("voice")}
          className="transition-all"
        >
          <Mic className="h-4 w-4 mr-2" /> Voz (Beta)
        </Button>
        <Button 
          variant={mode === "photo" ? "default" : "outline"} 
          size="sm" 
          onClick={() => setMode("photo")}
          className="transition-all"
        >
          <Camera className="h-4 w-4 mr-2" /> Foto / OCR
        </Button>
      </div>

      {/* Input Areas */}
      {!parsed && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {mode === "text" ? "O que aconteceu?" : mode === "voice" ? "Fale para capturar" : "Suba uma foto do recibo"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === "text" && (
              <div className="space-y-4">
                <Textarea
                  placeholder='Ex: "gastei 52 reais com pizza hoje" ou "mercado 320 ontem" ou "entrou 4500 de salário"'
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={4}
                  className="resize-none text-lg"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleParse(""); } }}
                />
                <Button onClick={() => handleParse("")} disabled={!textInput.trim()} className="w-full sm:w-auto">
                  <Send className="h-4 w-4 mr-2" /> Interpretar com IA
                </Button>
              </div>
            )}

            {mode === "voice" && (
              <div className="flex flex-col items-center py-8 space-y-4">
                <div className={`p-6 rounded-full transition-all ${isRecording ? "bg-red-100 animate-pulse" : "bg-muted"}`}>
                  <Mic className={`h-12 w-12 ${isRecording ? "text-red-600" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className="font-medium">{isRecording ? "Gravando..." : isTranscribing ? "Transcrevendo áudio..." : "Clique para falar"}</p>
                  <p className="text-sm text-muted-foreground">Descreva sua transação naturalmente</p>
                </div>
                <div className="flex gap-2">
                  {!isRecording ? (
                    <Button onClick={startRecording} disabled={isTranscribing} size="lg" className="rounded-full px-8">
                      Começar a falar
                    </Button>
                  ) : (
                    <Button onClick={stopRecording} variant="destructive" size="lg" className="rounded-full px-8">
                      Parar e Processar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {mode === "photo" && (
              <div className="flex flex-col items-center py-8 space-y-4 border-2 border-dashed border-muted rounded-xl">
                <div className={`p-6 rounded-full bg-muted ${isOcrProcessing ? "animate-pulse" : ""}`}>
                  {isOcrProcessing ? <Loader2 className="h-12 w-12 text-primary animate-spin" /> : <ImageIcon className="h-12 w-12 text-muted-foreground" />}
                </div>
                <div className="text-center px-4">
                  <p className="font-medium">{isOcrProcessing ? "Extraindo dados da imagem..." : "Selecione uma foto ou recibo"}</p>
                  <p className="text-sm text-muted-foreground">Formatos suportados: JPG, PNG. Extração via OCR inteligente.</p>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  disabled={isOcrProcessing}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isOcrProcessing}
                  variant="outline"
                  size="lg"
                >
                  <Camera className="h-4 w-4 mr-2" /> Escolher Foto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modo Espelho — Confirmation Card */}
      {parsed && (
        <Card className="border-2 border-primary shadow-lg animate-in zoom-in-95 duration-200">
          <CardHeader className="bg-primary/5 border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Modo Espelho — Confirme os Dados</CardTitle>
              </div>
              <div className="flex gap-2">
                <DataStatusBadge status="suggested" />
                <Badge variant={parsed.confianca === "alta" ? "success" : parsed.confianca === "media" ? "warning" : "destructive"}>
                  IA: {parsed.confianca}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Metadata Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" /> Origem: {editForm.source_type === "free_text" ? "Texto Livre" : editForm.source_type === "voice" ? "Voz" : "OCR/Foto"}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" /> Estado: Sugerida
              </Badge>
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                <Sparkles className="h-3 w-3" /> Escopo: {editForm.scope === 'private' ? 'Pessoal' : editForm.scope === 'family' ? 'Família' : 'Negócio'}
              </Badge>
            </div>

            {parsed.camposFaltantes.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg px-4 py-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Campos não detectados</p>
                  <p className="text-xs">A IA não encontrou com clareza: {parsed.camposFaltantes.join(", ")}</p>
                </div>
              </div>
            )}

            {isEditing ? (
              <div className="grid gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input type="number" step="0.01" value={editForm.valor}
                      onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))} className="font-mono text-lg" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={editForm.tipo} onValueChange={v => setEditForm(f => ({ ...f, tipo: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={editForm.descricao}
                    onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={editForm.data}
                      onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={editForm.categoria_id} onValueChange={v => setEditForm(f => ({ ...f, categoria_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {(categories || []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Escopo</Label>
                    <Select value={editForm.scope} onValueChange={v => setEditForm(f => ({ ...f, scope: v as "private" | "family" | "business" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Pessoal</SelectItem>
                        <SelectItem value="family">Família</SelectItem>
                        <SelectItem value="business">Negócio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-muted/20 rounded-xl border border-dashed">
                <InfoRow label="Valor Extraído" value={editForm.valor ? formatCurrency(Number(editForm.valor)) : "Não detectado"} highlight={!editForm.valor} />
                <InfoRow label="Tipo de Fluxo" value={editForm.tipo === "income" ? "Receita (+)" : "Despesa (-)"} />
                <InfoRow label="Descrição" value={editForm.descricao || "—"} highlight={!editForm.descricao} />
                <InfoRow label="Data da Ocorrência" value={editForm.data} />
                <InfoRow label="Categoria Sugerida" value={parsed.categoriaSugerida || "Não detectada"} highlight={!parsed.categoriaSugerida} />
                <InfoRow label="Escopo de Destino" value={editForm.scope === "private" ? "Pessoal" : editForm.scope === "family" ? "Família" : "Negócio"} isScope />
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-6 flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={isSaving || !editForm.valor} className="flex-1 min-w-[200px] h-12 text-lg">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              Confirmar e Salvar
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="h-12">
              <Edit className="h-4 w-4 mr-2" /> {isEditing ? "Ver Resumo" : "Ajustar Dados"}
            </Button>
            <Button variant="ghost" onClick={handleDiscard} className="h-12 text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4 mr-2" /> Descartar
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value, highlight = false, isScope = false }: { label: string; value: string; highlight?: boolean; isScope?: boolean }) {
  return (
    <div className={`space-y-1 p-2 rounded-lg ${highlight ? "bg-warning/5 border border-warning/20" : ""}`}>
      <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{label}</p>
      <p className={`text-base font-medium ${isScope ? "text-primary" : ""}`}>
        {value}
        {highlight && <span className="ml-2 text-[10px] text-warning">(Atenção)</span>}
      </p>
    </div>
  );
}
