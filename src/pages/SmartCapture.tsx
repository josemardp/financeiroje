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
  Mic, Camera, Type, Send, Check, Edit, AlertCircle,
  Loader2, Trash2, Save, FileText, Image as ImageIcon, Sparkles
} from "lucide-react";

type CaptureMode = "text" | "voice" | "photo";

type MirrorFormState = {
  valor: string;
  tipo: "" | "income" | "expense";
  descricao: string;
  data: string;
  categoria_id: string;
  scope: string;
  source_type: string;
};

const SUPPORTED_OCR_TYPES = ["image/png", "image/jpeg", "image/jpg", "application/pdf"] as const;

function normalizeLearningText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default function SmartCapture() {
  const { user } = useAuth();
  const { currentScope, scopeLabel } = useScope();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<CaptureMode>("text");
  const [textInput, setTextInput] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  const { isRecording, isTranscribing, result: voiceResult, startRecording, stopRecording, resetVoice } = useVoiceCapture();
  const { isProcessing: isOcrProcessing, result: ocrResult, processImage, resetOcr } = useOcrCapture();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState<MirrorFormState>({
    valor: "",
    tipo: "",
    descricao: "",
    data: "",
    categoria_id: "",
    scope: "private",
    source_type: "free_text",
  });

  const updateEditForm = (updater: (current: MirrorFormState) => MirrorFormState) => {
    setEditForm((current) => updater(current));
    setReviewConfirmed(false);
  };

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
      const extractedText = ocrResult.text;
      setTextInput(extractedText);
      handleParse(extractedText, "photo_ocr", ocrResult.metadata);
      resetOcr();
    }
  }, [ocrResult]);

  const extractedSnapshot = parsed
    ? {
        valor: parsed.valor,
        tipo: parsed.tipo,
        descricao: parsed.descricao,
        data: parsed.data,
        categoriaSugerida: parsed.categoriaSugerida,
        escopo: parsed.escopo,
        confianca: parsed.confianca,
        textoOriginal: parsed.textoOriginal,
      }
    : null;

  const reviewedSnapshot = parsed
    ? {
        valor: editForm.valor ? Number(editForm.valor) : null,
        tipo: editForm.tipo || null,
        descricao: editForm.descricao,
        data: editForm.data,
        categoria_id: editForm.categoria_id || null,
        scope: editForm.scope,
        source_type: editForm.source_type,
      }
    : null;

  const handleParse = (input: string, source: string = "free_text", ocrMetadata?: any) => {
    const textToParse = input || textInput;
    if (!textToParse.trim()) return;

    const result = parseTransactionText(textToParse);

    if (source === "photo_ocr" && ocrMetadata) {
      if (ocrMetadata.totalAmount !== undefined) result.valor = ocrMetadata.totalAmount;
      if (ocrMetadata.date) result.data = ocrMetadata.date;
      if (ocrMetadata.merchantName) result.descricao = ocrMetadata.merchantName;
      if (ocrMetadata.tipo) result.tipo = ocrMetadata.tipo;
      if (ocrMetadata.categoria) result.categoriaSugerida = ocrMetadata.categoria;
      if (ocrMetadata.warnings) result.warnings = [...(result.warnings || []), ...ocrMetadata.warnings];
    }

    setParsed(result);
    setIsEditing(false);
    setReviewConfirmed(false);

    setEditForm({
      valor: result.valor?.toString() || "",
      tipo: result.tipo ?? "",
      descricao: result.descricao,
      data: result.data,
      categoria_id: "",
      scope: currentScope === "all" ? result.escopo : currentScope,
      source_type: source,
    });

    if (result.categoriaSugerida && categories) {
      const match = categories.find((c: any) =>
        c.nome.toLowerCase().includes(result.categoriaSugerida!.toLowerCase())
      );
      if (match) {
        setEditForm((current) => ({ ...current, categoria_id: match.id }));
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

    if (!editForm.tipo) {
      toast.error("Defina manualmente se é receita ou despesa");
      return;
    }

    if (!reviewConfirmed) {
      toast.error("Confirme explicitamente a revisão antes de salvar");
      return;
    }

    setIsSaving(true);

    const originalInput = parsed?.textoOriginal || textInput;
    const validationNotes = JSON.stringify({
      original_input: originalInput,
      extracted_payload: extractedSnapshot,
      reviewed_payload: reviewedSnapshot,
    });

    const { data: insertedTransaction, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        valor: Number(editForm.valor),
        tipo: editForm.tipo as any,
        categoria_id: editForm.categoria_id || null,
        descricao: editForm.descricao,
        data: editForm.data,
        scope: editForm.scope as any,
        data_status: "confirmed" as any,
        source_type: editForm.source_type as any,
        confidence: (parsed?.confianca || "media") as any,
        created_by: user.id,
        updated_by: user.id,
        validation_notes: validationNotes,
      })
      .select("id")
      .single();

    if (error || !insertedTransaction) {
      toast.error("Erro ao salvar", { description: error?.message || "Falha ao salvar transação." });
      setIsSaving(false);
      return;
    }

    try {
      await supabase.from("smart_capture_learning").insert({
        user_id: user.id,
        transaction_id: insertedTransaction.id,
        source_text: originalInput,
        normalized_text: normalizeLearningText(originalInput),
        source_type: editForm.source_type as any,
        suggested_payload: extractedSnapshot as any,
        final_payload: reviewedSnapshot as any,
        category_id: editForm.categoria_id || null,
        transaction_type: editForm.tipo as any,
        scope: editForm.scope as any,
        confidence_before: (parsed?.confianca || "media") as any,
        confirmation_method: "mirror_confirmed"
      });
    } catch (learnErr) {
      console.error("Erro ao registrar aprendizado:", learnErr);
    }

    toast.success("Transação confirmada e registrada", {
      description: `Salva no escopo: ${editForm.scope === "private" ? "Pessoal" : editForm.scope === "family" ? "Família" : "Negócio"}.`,
    });

    setParsed(null);
    setTextInput("");
    setReviewConfirmed(false);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
    setIsSaving(false);
  };

  const handleDiscard = () => {
    setParsed(null);
    setTextInput("");
    setReviewConfirmed(false);
    toast.info("Captura descartada");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const isSupported = SUPPORTED_OCR_TYPES.includes(
      file.type as (typeof SUPPORTED_OCR_TYPES)[number]
    );

    if (!isSupported) {
      const isOffice = file.type.includes("word") || file.type.includes("excel") || file.type.includes("officedocument") || file.name.endsWith(".docx") || file.name.endsWith(".xlsx");
      toast.error(isOffice ? "Formato ainda não liberado" : "Formato não suportado", {
        description: isOffice 
          ? "Word e Excel ainda não estão liberados. Por enquanto, use PDF, JPG ou PNG."
          : "Use PDF, JPG ou PNG para captura automática.",
      });
      e.target.value = "";
      return;
    }

    processImage(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Captura Inteligente Premium"
        description={`Modo Espelho ativo — Escopo atual: ${scopeLabel}`}
      />

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
          <Mic className="h-4 w-4 mr-2" /> Voz
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
                  <p className="font-medium">{isOcrProcessing ? "Extraindo dados do arquivo..." : "Selecione uma foto, print, recibo ou PDF"}</p>
                  <p className="text-sm text-muted-foreground">Formatos suportados agora: PDF, JPG e PNG. Word e Excel ainda não estão liberados.</p>
                </div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
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
                  <FileText className="h-4 w-4 mr-2" /> Escolher Arquivo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                <Badge variant={parsed.confianca === "alta" ? "default" : parsed.confianca === "media" ? "secondary" : "destructive"}>
                  IA: {parsed.confianca}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" /> Origem: {editForm.source_type === "free_text" ? "Texto Livre" : editForm.source_type === "voice" ? "Voz" : "OCR/Foto"}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" /> Estado: Confirmar manualmente
              </Badge>
              <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                <Sparkles className="h-3 w-3" /> Escopo: {editForm.scope === "private" ? "Pessoal" : editForm.scope === "family" ? "Família" : "Negócio"}
              </Badge>
            </div>

            {parsed.camposFaltantes.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg px-4 py-3">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-700">Campos não detectados</p>
                  <p className="text-xs text-amber-600">A IA não encontrou com clareza: {parsed.camposFaltantes.join(", ")}</p>
                </div>
              </div>
            )}

            {parsed.warnings && parsed.warnings.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Atenção na extração</p>
                  <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                    {parsed.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Payload extraído</p>
                <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(extractedSnapshot, null, 2)}</pre>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Payload revisado</p>
                <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(reviewedSnapshot, null, 2)}</pre>
              </div>
            </div>

            {isEditing ? (
              <div className="grid gap-4 p-4 bg-muted/30 rounded-xl border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.valor}
                      onChange={e => updateEditForm(f => ({ ...f, valor: e.target.value }))}
                      className="font-mono text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={editForm.tipo}
                      onValueChange={v => updateEditForm(f => ({ ...f, tipo: v as "" | "income" | "expense" }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input
                    value={editForm.descricao}
                    onChange={e => updateEditForm(f => ({ ...f, descricao: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={editForm.data}
                      onChange={e => updateEditForm(f => ({ ...f, data: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={editForm.categoria_id} onValueChange={v => updateEditForm(f => ({ ...f, categoria_id: v }))}>
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
                    <Select value={editForm.scope} onValueChange={v => updateEditForm(f => ({ ...f, scope: v as "private" | "family" | "business" }))}>
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
                <InfoRow
                  label="Tipo de Fluxo"
                  value={
                    editForm.tipo === "income"
                      ? "Receita (+)"
                      : editForm.tipo === "expense"
                        ? "Despesa (-)"
                        : "Não definido"
                  }
                  highlight={!editForm.tipo}
                />
                <InfoRow label="Descrição" value={editForm.descricao || "—"} highlight={!editForm.descricao} />
                <InfoRow label="Data da Ocorrência" value={editForm.data} />
                <InfoRow label="Categoria Sugerida" value={parsed.categoriaSugerida || "Não detectada"} highlight={!parsed.categoriaSugerida} />
                <InfoRow label="Escopo de Destino" value={editForm.scope === "private" ? "Pessoal" : editForm.scope === "family" ? "Família" : "Negócio"} isScope />
              </div>
            )}

            <label className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={reviewConfirmed}
                onChange={(e) => setReviewConfirmed(e.target.checked)}
              />
              <div>
                <p className="text-sm font-medium">Confirmo explicitamente que revisei os dados extraídos e os dados revisados antes de salvar.</p>
                <p className="text-xs text-muted-foreground">Sem essa confirmação, a persistência é bloqueada.</p>
              </div>
            </label>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-6 flex flex-wrap gap-3">
            <Button onClick={handleSave} disabled={isSaving || !editForm.valor || !reviewConfirmed} className="flex-1 min-w-[200px] h-12 text-lg">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              Confirmar e Salvar
            </Button>
            <Button variant="outline" onClick={() => { setIsEditing(!isEditing); setReviewConfirmed(false); }} className="h-12">
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
