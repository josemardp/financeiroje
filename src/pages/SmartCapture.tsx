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
import { extractTextFromSupportedFile } from "@/services/smartCapture/fileExtraction";
import {
  Mic,
  Camera,
  Type,
  Send,
  Check,
  Edit,
  AlertCircle,
  Loader2,
  Trash2,
  Save,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Paperclip,
} from "lucide-react";

type CaptureMode = "text" | "voice" | "file";

export default function SmartCapture() {
  const { user } = useAuth();
  const { currentScope, scopeLabel } = useScope();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<CaptureMode>("text");
  const [textInput, setTextInput] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { isRecording, isTranscribing, result: voiceResult, startRecording, stopRecording, resetVoice } = useVoiceCapture();
  const { isProcessing: isOcrProcessing, result: ocrResult, processImage, resetOcr } = useOcrCapture();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);

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

  useEffect(() => {
    if (voiceResult) {
      setTextInput(voiceResult.text);
      handleParse(voiceResult.text, "voice");
      resetVoice();
    }
  }, [voiceResult]);

  useEffect(() => {
    if (ocrResult) {
      handleParse(ocrResult.text, "photo_ocr");
      resetOcr();
    }
  }, [ocrResult]);

  const handleParse = (input: string, source: string = "free_text") => {
    const textToParse = input || textInput;
    if (!textToParse.trim()) return;

    const result = parseTransactionText(textToParse);
    setParsed(result);
    setIsEditing(false);

    setEditForm({
      valor: result.valor?.toString() || "",
      tipo: result.tipo,
      descricao: result.descricao,
      data: result.data,
      categoria_id: "",
      scope: currentScope === "all" ? result.escopo : currentScope,
      source_type: source,
    });

    if (result.categoriaSugerida && categories) {
      const match = categories.find((c: any) =>
        c.nome.toLowerCase().includes(result.categoriaSugerida!.toLowerCase()),
      );
      if (match) {
        setEditForm((f) => ({ ...f, categoria_id: match.id }));
      }
    }

    toast.success("Dados extraídos com sucesso!", {
      description: "Revise no Modo Espelho abaixo.",
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
        description: `Salva no escopo: ${editForm.scope === "private" ? "Pessoal" : editForm.scope === "family" ? "Família" : "Negócio"}.`,
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
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Captura Inteligente Premium"
        description={`Modo Espelho ativo — Escopo atual: ${scopeLabel}`}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          variant={mode === "text" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("text")}
          className="flex-1 justify-center transition-all sm:flex-none"
        >
          <Type className="mr-2 h-4 w-4" /> Texto Livre
        </Button>
        <Button
          variant={mode === "voice" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("voice")}
          className="flex-1 justify-center transition-all sm:flex-none"
        >
          <Mic className="mr-2 h-4 w-4" /> Voz (Beta)
        </Button>
        <Button
          variant={mode === "photo" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("photo")}
          className="flex-1 justify-center transition-all sm:flex-none"
        >
          <Camera className="mr-2 h-4 w-4" /> Foto / OCR
        </Button>
      </div>

      {!parsed && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
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
                  className="resize-none text-base sm:text-lg"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleParse("");
                    }
                  }}
                />
                <Button onClick={() => handleParse("")} disabled={!textInput.trim()} className="w-full sm:w-auto">
                  <Send className="mr-2 h-4 w-4" /> Interpretar com IA
                </Button>
              </div>
            )}

            {mode === "voice" && (
              <div className="flex flex-col items-center space-y-4 py-8">
                <div className={`rounded-full p-6 transition-all ${isRecording ? "animate-pulse bg-red-100" : "bg-muted"}`}>
                  <Mic className={`h-12 w-12 ${isRecording ? "text-red-600" : "text-muted-foreground"}`} />
                </div>
                <div className="text-center">
                  <p className="font-medium">{isRecording ? "Gravando..." : isTranscribing ? "Transcrevendo áudio..." : "Clique para falar"}</p>
                  <p className="text-sm text-muted-foreground">Descreva sua transação naturalmente</p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  {!isRecording ? (
                    <Button onClick={startRecording} disabled={isTranscribing} size="lg" className="w-full rounded-full px-8 sm:w-auto">
                      Começar a falar
                    </Button>
                  ) : (
                    <Button onClick={stopRecording} variant="destructive" size="lg" className="w-full rounded-full px-8 sm:w-auto">
                      Parar e Processar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {mode === "photo" && (
              <div className="flex flex-col items-center space-y-4 rounded-xl border-2 border-dashed border-muted py-8">
                <div className={`rounded-full bg-muted p-6 ${isOcrProcessing ? "animate-pulse" : ""}`}>
                  {isOcrProcessing ? <Loader2 className="h-12 w-12 animate-spin text-primary" /> : <ImageIcon className="h-12 w-12 text-muted-foreground" />}
                </div>
                <div className="px-4 text-center">
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
                  className="w-full sm:w-auto"
                >
                  <Camera className="mr-2 h-4 w-4" /> Escolher Foto
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {parsed && (
        <Card className="animate-in zoom-in-95 border-2 border-primary shadow-lg duration-200">
          <CardHeader className="border-b bg-primary/5 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Modo Espelho — Confirme os Dados</CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                <DataStatusBadge status="suggested" />
                <Badge variant={parsed.confianca === "alta" ? "default" : parsed.confianca === "media" ? "secondary" : "destructive"}>
                  IA: {parsed.confianca}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" /> Origem: {editForm.source_type === "free_text" ? "Texto Livre" : editForm.source_type === "voice" ? "Voz" : "OCR/Foto"}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" /> Estado: Sugerida
              </Badge>
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                <Sparkles className="h-3 w-3" /> Escopo: {editForm.scope === "private" ? "Pessoal" : editForm.scope === "family" ? "Família" : "Negócio"}
              </Badge>
            </div>

            {parsed.camposFaltantes.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Campos não detectados</p>
                  <p className="text-xs">A IA não encontrou com clareza: {parsed.camposFaltantes.join(", ")}</p>
                </div>
              </div>
            )}

            {isEditing ? (
              <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.valor}
                      onChange={(e) => setEditForm((f) => ({ ...f, valor: e.target.value }))}
                      className="font-mono text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={editForm.tipo} onValueChange={(v) => setEditForm((f) => ({ ...f, tipo: v }))}>
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
                  <Input value={editForm.descricao} onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={editForm.data} onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={editForm.categoria_id} onValueChange={(v) => setEditForm((f) => ({ ...f, categoria_id: v }))}>
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
                    <Select value={editForm.scope} onValueChange={(v) => setEditForm((f) => ({ ...f, scope: v as "private" | "family" | "business" }))}>
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
              <div className="grid grid-cols-1 gap-6 rounded-xl border border-dashed bg-muted/20 p-4 md:grid-cols-2">
                <InfoRow label="Valor Extraído" value={editForm.valor ? formatCurrency(Number(editForm.valor)) : "Não detectado"} highlight={!editForm.valor} />
                <InfoRow label="Tipo de Fluxo" value={editForm.tipo === "income" ? "Receita (+)" : "Despesa (-)"} />
                <InfoRow label="Descrição" value={editForm.descricao || "—"} highlight={!editForm.descricao} />
                <InfoRow label="Data da Ocorrência" value={editForm.data} />
                <InfoRow label="Categoria Sugerida" value={parsed.categoriaSugerida || "Não detectada"} highlight={!parsed.categoriaSugerida} />
                <InfoRow label="Escopo de Destino" value={editForm.scope === "private" ? "Pessoal" : editForm.scope === "family" ? "Família" : "Negócio"} isScope />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3 border-t bg-muted/10 p-6 sm:flex-row sm:flex-wrap">
            <Button onClick={handleSave} disabled={isSaving || !editForm.valor} className="h-12 w-full text-lg sm:min-w-[200px] sm:flex-1">
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Confirmar e Salvar
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(!isEditing)} className="h-12 w-full sm:w-auto">
              <Edit className="mr-2 h-4 w-4" /> {isEditing ? "Ver Resumo" : "Ajustar Dados"}
            </Button>
            <Button variant="ghost" onClick={handleDiscard} className="h-12 w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" /> Descartar
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value, highlight = false, isScope = false }: { label: string; value: string; highlight?: boolean; isScope?: boolean }) {
  return (
    <div className={`space-y-1 rounded-lg p-2 ${highlight ? "border border-warning/20 bg-warning/5" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`break-words text-base font-medium ${isScope ? "text-primary" : ""}`}>
        {value}
        {highlight && <span className="ml-2 text-[10px] text-warning">(Atenção)</span>}
      </p>
    </div>
  );
}
