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
import {
  InterpretAdapter,
  type InterpretResult,
  type InterpretSourceKind,
} from "@/services/smartCapture/adapters/InterpretAdapter";
import type { OcrExtractionResult } from "@/services/smartCapture/adapters/OcrAdapter";
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
  Type,
  Send,
  Check,
  Edit,
  AlertCircle,
  Loader2,
  Trash2,
  Save,
  FileText,
  Sparkles,
  Paperclip,
} from "lucide-react";

type CaptureMode = "text" | "voice" | "file";

function mapOcrConfidence(
  metadata?: { confidence?: "alta" | "media" | "baixa" },
  raw = 0.6
): ParsedTransaction["confianca"] {
  const explicit = metadata?.confidence;
  if (explicit === "alta" || explicit === "media" || explicit === "baixa") return explicit;
  if (raw >= 0.85) return "alta";
  if (raw >= 0.65) return "media";
  return "baixa";
}

type StructuredCaptureMetadata = {
  transactionType?: "income" | "expense" | "unknown";
  amount?: number | null;
  date?: string;
  description?: string;
  scope?: "private" | "family" | "business" | "unknown";
  categoryHint?: string;
  evidence?: string[];
  confidence?: "alta" | "media" | "baixa";
  merchantName?: string;
  counterparty?: string;
  installmentText?: string | null;
};

type StructuredCaptureResult = {
  text: string;
  confidence: number;
  metadata?: StructuredCaptureMetadata;
  missingFields?: string[];
};

function mapStructuredCaptureToParsed(result: StructuredCaptureResult): ParsedTransaction {
  const fallback = parseTransactionText(result.text);
  const metadata = result.metadata;

  const hasTypeFromMetadata =
    metadata?.transactionType === "income" || metadata?.transactionType === "expense";
  const hasAmountFromMetadata =
    typeof metadata?.amount === "number" && metadata.amount > 0;
  const hasDateFromMetadata =
    typeof metadata?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(metadata.date);

  // REGRA: Se a IA respondeu (metadata existe) mas NÃO retornou amount,
  // NÃO completar com fallback local silenciosamente. Manter null.
  const aiResponded = metadata !== undefined;
  const finalValor = hasAmountFromMetadata
    ? metadata!.amount ?? null
    : aiResponded
      ? null  // IA respondeu mas sem amount → manter null, não usar fallback
      : fallback.valor;

  const finalTipo = hasTypeFromMetadata
    ? (metadata!.transactionType as "income" | "expense")
    : fallback.tipo;
  const finalData = hasDateFromMetadata ? metadata!.date! : fallback.data;

  const finalDescription = (
    metadata?.description?.trim() ||
    metadata?.merchantName?.trim() ||
    metadata?.counterparty?.trim() ||
    fallback.descricao
  ).trim();

  const hasFinalAmount = typeof finalValor === "number" && finalValor > 0;
  const hasFinalType = finalTipo === "income" || finalTipo === "expense";
  const hasFinalDate =
    typeof finalData === "string" && /^\d{4}-\d{2}-\d{2}$/.test(finalData);
  const hasFinalDescription = Boolean(finalDescription);

  const installmentText = metadata?.installmentText || fallback.installmentText || null;
  const installmentCountMatch = installmentText?.match(/^(\d{1,2})/);
  const installmentCount = installmentCountMatch ? parseInt(installmentCountMatch[1], 10) : fallback.installmentCount || null;

  const observacoes = [
    ...((metadata?.evidence || []).slice(0, 6).map((item) => `Evidência IA: ${item}`)),
    ...(!hasTypeFromMetadata && hasFinalType
      ? ["Tipo preenchido por fallback local; revise no Modo Espelho."]
      : !hasFinalType
        ? ["Tipo da transação não foi identificado com segurança."]
        : []),
    ...(aiResponded && !hasAmountFromMetadata
      ? ["Valor principal não retornado pela IA; preencha manualmente no Modo Espelho."]
      : !aiResponded && !hasFinalAmount
        ? ["Valor principal não foi identificado com segurança."]
        : []),
    ...(!hasDateFromMetadata && hasFinalDate
      ? ["Data preenchida por fallback local; revise no Modo Espelho."]
      : !hasFinalDate
        ? ["Data não foi identificada com segurança."]
        : []),
    ...(installmentText ? [`Parcelamento detectado: ${installmentText}`] : []),
    ...fallback.observacoes.filter((obs) => {
      if (
        obs === "Tipo da transação não foi identificado com clareza; mantido padrão conservador." &&
        hasFinalType
      ) return false;
      if (
        obs === "Nenhuma data explícita encontrada; usado o dia atual como fallback." &&
        hasDateFromMetadata
      ) return false;
      return true;
    }),
  ].slice(0, 8);

  const camposFaltantes = Array.from(
    new Set([
      ...(hasFinalAmount ? [] : ["valor"]),
      ...(hasFinalType ? [] : ["tipo"]),
      ...(hasFinalDate ? [] : ["data"]),
      ...(hasFinalDescription ? [] : ["descricao"]),
      ...((metadata?.categoryHint || fallback.categoriaSugerida) ? [] : ["categoria"]),
      ...((result.missingFields || []).filter(Boolean)),
    ])
  );

  // Determine status
  const status: ParsedTransaction["status"] =
    hasFinalAmount && hasFinalType ? "complete" : camposFaltantes.length > 2 ? "ambiguous" : "partial";

  return {
    valor: finalValor,
    tipo: finalTipo,
    descricao: finalDescription || fallback.descricao,
    data: finalData,
    categoriaSugerida: metadata?.categoryHint || fallback.categoriaSugerida,
    escopo:
      metadata?.scope === "family" ||
      metadata?.scope === "business" ||
      metadata?.scope === "private"
        ? metadata.scope
        : fallback.escopo,
    confianca: mapOcrConfidence(metadata, result.confidence),
    textoOriginal: result.text,
    observacoes,
    camposFaltantes,
    installmentText,
    installmentCount,
    status,
  };
}

function mapStructuredOcrToParsed(result: OcrExtractionResult): ParsedTransaction {
  return mapStructuredCaptureToParsed(result);
}

function mapStructuredInterpretToParsed(result: InterpretResult): ParsedTransaction {
  return mapStructuredCaptureToParsed(result);
}

function appendFallbackWarning(
  result: ParsedTransaction,
  reason?: string
): ParsedTransaction {
  const details = reason?.trim();
  const warning = details
    ? `Interpretação estruturada indisponível; aplicado fallback local. Motivo: ${details}`
    : "Interpretação estruturada indisponível; aplicado fallback local.";

  return {
    ...result,
    confianca: result.confianca === "alta" ? "media" : "baixa",
    observacoes: [warning, ...(result.observacoes || [])].slice(0, 8),
  };
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
  const [installmentStart, setInstallmentStart] = useState<"this_month" | "next_month" | null>(null);
  const {
    isRecording,
    isTranscribing,
    result: voiceResult,
    startRecording,
    stopRecording,
    resetVoice,
  } = useVoiceCapture();

  const {
    isProcessing: isOcrProcessing,
    result: ocrResult,
    processImage,
    resetOcr,
  } = useOcrCapture();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("Texto Livre");

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

  const applyParsedResult = (result: ParsedTransaction, source: string, label?: string) => {
    setParsed(result);
    setIsEditing(false);
    setInstallmentStart(null);
    setSourceLabel(
      label ||
        (source === "free_text"
          ? "Texto Livre"
          : source === "voice"
            ? "Voz"
            : "OCR/Foto")
    );

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
        c.nome.toLowerCase().includes(result.categoriaSugerida!.toLowerCase())
      );

      if (match) {
        setEditForm((f) => ({ ...f, categoria_id: match.id }));
      }
    }
  };

  useEffect(() => {
    if (!voiceResult) return;

    let active = true;

    void (async () => {
      setTextInput(voiceResult.text);

      try {
        const interpreted = await InterpretAdapter.interpret({
          text: voiceResult.text,
          sourceKind: "voice_transcript",
        });

        if (!active) return;

        const result = mapStructuredInterpretToParsed(interpreted);
        applyParsedResult(result, "voice", "Voz");

        toast.success("Dados extraídos com IA", {
          description: "Revise no Modo Espelho abaixo.",
        });
      } catch (error) {
        if (!active) return;

        const fallback = appendFallbackWarning(
          parseTransactionText(voiceResult.text),
          error instanceof Error ? error.message : undefined
        );

        applyParsedResult(fallback, "voice", "Voz");

        const msg =
          error instanceof Error ? error.message : "Erro na interpretação da transcrição";

        toast.warning("Transcrição concluída com fallback local", {
          description: `${msg} Revise com atenção no Modo Espelho.`,
        });
      } finally {
        if (active) {
          resetVoice();
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [voiceResult, resetVoice]);

  useEffect(() => {
    if (!ocrResult) return;

    let active = true;

    void (async () => {
      const ocrText = ocrResult.text?.trim();
      resetOcr();

      if (!ocrText) {
        const mapped = mapStructuredOcrToParsed(ocrResult);
        applyParsedResult(mapped, "photo_ocr", "OCR/Foto");
        toast.warning("OCR não conseguiu extrair texto legível.");
        return;
      }

      try {
        const interpreted = await InterpretAdapter.interpret({
          text: ocrText,
          sourceKind: "free_text",
        });

        if (!active) return;

        const result = mapStructuredInterpretToParsed(interpreted);
        applyParsedResult(result, "photo_ocr", "OCR/Foto");

        toast.success("Dados extraídos com IA (OCR + Interpretação)", {
          description:
            result.confianca === "baixa"
              ? "A IA encontrou evidências, mas com baixa confiança. Revise com atenção."
              : "Revise no Modo Espelho abaixo.",
        });
      } catch (error) {
        if (!active) return;

        const fallback = appendFallbackWarning(
          parseTransactionText(ocrText),
          error instanceof Error ? error.message : undefined
        );

        applyParsedResult(fallback, "photo_ocr", "OCR/Foto");

        toast.warning("OCR concluído com fallback local", {
          description: "A interpretação estruturada falhou. Revise no Modo Espelho.",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [ocrResult, resetOcr]);

  const handleParse = async (
    input: string,
    source: string = "free_text",
    sourceKind: InterpretSourceKind = "free_text",
    label?: string
  ) => {
    const textToParse = (input || textInput).trim();
    if (!textToParse) return;

    try {
      const interpreted = await InterpretAdapter.interpret({
        text: textToParse,
        sourceKind,
      });

      const result = mapStructuredInterpretToParsed(interpreted);
      applyParsedResult(result, source, label);

      toast.success("Dados extraídos com IA", {
        description: "Revise no Modo Espelho abaixo.",
      });
    } catch (error) {
      const fallback = appendFallbackWarning(
        parseTransactionText(textToParse),
        error instanceof Error ? error.message : undefined
      );

      applyParsedResult(fallback, source, label);

      const msg = error instanceof Error ? error.message : "Erro na interpretação";

      toast.warning("Interpretação parcialmente degradada", {
        description: `${msg} Revise com atenção no Modo Espelho.`,
      });
    }
  };

  const hasInstallment = parsed && parsed.installmentCount && parsed.installmentCount > 1;
  const needsInstallmentAnswer = hasInstallment && installmentStart === null;

  const handleSave = async () => {
    if (!user || !editForm.valor || Number(editForm.valor) <= 0) {
      toast.error("Valor inválido");
      return;
    }

    if (needsInstallmentAnswer) {
      toast.error("Selecione quando começa a primeira parcela antes de salvar.");
      return;
    }

    setIsSaving(true);

    const validationNotes = [
      `Texto original: "${parsed?.textoOriginal || textInput}"`,
      ...(parsed?.observacoes?.length
        ? [`Observações: ${parsed.observacoes.join(" | ")}`]
        : []),
    ].join("\n");

    const totalValue = Number(editForm.valor);
    const installCount = parsed?.installmentCount || 1;
    const isInstallmentPurchase = installCount > 1 && installmentStart !== null;

    if (isInstallmentPurchase) {
      // Create one transaction per installment
      const parcelaValue = Math.round((totalValue / installCount) * 100) / 100;
      const now = new Date();
      const startMonth = installmentStart === "next_month" ? 1 : 0;

      const installmentRows = Array.from({ length: installCount }, (_, i) => {
        const installDate = new Date(now.getFullYear(), now.getMonth() + startMonth + i, 1);
        // Use day from editForm.data if available, else 1st of month
        const baseDay = editForm.data ? new Date(editForm.data).getDate() : 1;
        const safeDay = Math.min(baseDay, new Date(installDate.getFullYear(), installDate.getMonth() + 1, 0).getDate());
        installDate.setDate(safeDay);

        const isoDate = installDate.toISOString().split("T")[0];

        return {
          user_id: user.id,
          valor: parcelaValue,
          tipo: editForm.tipo as any,
          categoria_id: editForm.categoria_id || null,
          descricao: `${editForm.descricao} (${i + 1}/${installCount})`,
          data: isoDate,
          scope: editForm.scope as any,
          data_status: "confirmed" as any,
          source_type: editForm.source_type as any,
          confidence: (parsed?.confianca as any) || "media",
          created_by: user.id,
          validation_notes: `${validationNotes}\nParcela ${i + 1}/${installCount} — Total: ${totalValue} — Início: ${installmentStart}`,
        };
      });

      const { error } = await supabase.from("transactions").insert(installmentRows);

      if (error) {
        toast.error("Erro ao salvar parcelas", { description: error.message });
      } else {
        toast.success(`${installCount} parcelas criadas com sucesso`, {
          description: `Valor por parcela: R$ ${parcelaValue.toFixed(2)} — de ${installmentRows[0].data} a ${installmentRows[installCount - 1].data}`,
        });

        setParsed(null);
        setTextInput("");
        setInstallmentStart(null);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      }
    } else {
      // Single transaction (original flow)
      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        valor: totalValue,
        tipo: editForm.tipo as any,
        categoria_id: editForm.categoria_id || null,
        descricao: editForm.descricao,
        data: editForm.data,
        scope: editForm.scope as any,
        data_status: "confirmed" as any,
        source_type: editForm.source_type as any,
        confidence: (parsed?.confianca as any) || "media",
        created_by: user.id,
        validation_notes: validationNotes,
      });

      if (error) {
        toast.error("Erro ao salvar", { description: error.message });
      } else {
        toast.success("Transação confirmada com sucesso", {
          description: `Salva no escopo: ${
            editForm.scope === "private"
              ? "Pessoal"
              : editForm.scope === "family"
                ? "Família"
                : "Negócio"
          }.`,
        });

        setParsed(null);
        setTextInput("");
        setInstallmentStart(null);
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-transactions"] });
      }
    }

    setIsSaving(false);
  };

  const handleDiscard = () => {
    setParsed(null);
    setTextInput("");
    toast.info("Captura descartada");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    const resetInput = () => {
      input.value = "";
    };

    if (!file) return;

    const name = file.name.toLowerCase();
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isDocx = name.endsWith(".docx");
    const isSpreadsheet = name.endsWith(".xlsx") || name.endsWith(".xls");
    const isDoc = name.endsWith(".doc") && !name.endsWith(".docx");

    if (isDoc) {
      toast.error("Formato .doc não suportado. Converta para .docx.");
      resetInput();
      return;
    }

    if (isSpreadsheet) {
      toast.error(
        "Planilhas ainda não são suportadas na Captura Inteligente. Use importação estruturada."
      );
      resetInput();
      return;
    }

    if (isImage) {
      try {
        await processImage(file);
      } finally {
        resetInput();
      }
      return;
    }

    if (isPdf || isDocx) {
      setIsExtractingFile(true);

      try {
        const result = await extractTextFromSupportedFile(file);

        const sourceKind: InterpretSourceKind =
          result.source === "pdf" ? "pdf_text" : "docx_text";

        const sourceLabelForUi = result.source === "pdf" ? "PDF" : "DOCX";

        await handleParse(result.text, "free_text", sourceKind, sourceLabelForUi);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Erro ao processar arquivo";
        toast.error(msg);
      } finally {
        setIsExtractingFile(false);
        resetInput();
      }

      return;
    }

    toast.error("Formato de arquivo não suportado");
    resetInput();
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
          variant={mode === "file" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("file")}
          className="flex-1 justify-center transition-all sm:flex-none"
        >
          <Paperclip className="mr-2 h-4 w-4" /> Arquivo / OCR
        </Button>
      </div>

      {!parsed && (
        <Card className="border-primary/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {mode === "text"
                ? "O que aconteceu?"
                : mode === "voice"
                  ? "Fale para capturar"
                  : "Envie uma foto ou documento"}
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
                      void handleParse("");
                    }
                  }}
                />

                <Button
                  onClick={() => void handleParse("")}
                  disabled={!textInput.trim()}
                  className="w-full sm:w-auto"
                >
                  <Send className="mr-2 h-4 w-4" /> Interpretar com IA
                </Button>
              </div>
            )}

            {mode === "voice" && (
              <div className="flex flex-col items-center space-y-4 py-8">
                <div
                  className={`rounded-full p-6 transition-all ${
                    isRecording ? "animate-pulse bg-red-100" : "bg-muted"
                  }`}
                >
                  <Mic
                    className={`h-12 w-12 ${
                      isRecording ? "text-red-600" : "text-muted-foreground"
                    }`}
                  />
                </div>

                <div className="text-center">
                  <p className="font-medium">
                    {isRecording
                      ? "Gravando..."
                      : isTranscribing
                        ? "Transcrevendo áudio..."
                        : "Clique para falar"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Descreva sua transação naturalmente
                  </p>
                </div>

                <div className="flex w-full gap-2 sm:w-auto">
                  {!isRecording ? (
                    <Button
                      onClick={startRecording}
                      disabled={isTranscribing}
                      size="lg"
                      className="w-full rounded-full px-8 sm:w-auto"
                    >
                      Começar a falar
                    </Button>
                  ) : (
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                      className="w-full rounded-full px-8 sm:w-auto"
                    >
                      Parar e Processar
                    </Button>
                  )}
                </div>
              </div>
            )}

            {mode === "file" && (
              <div className="flex flex-col items-center space-y-4 rounded-xl border-2 border-dashed border-muted py-8">
                <div
                  className={`rounded-full bg-muted p-6 ${
                    isOcrProcessing || isExtractingFile ? "animate-pulse" : ""
                  }`}
                >
                  {isOcrProcessing || isExtractingFile ? (
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  ) : (
                    <Paperclip className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>

                <div className="px-4 text-center">
                  <p className="font-medium">
                    {isOcrProcessing
                      ? "Extraindo dados da imagem..."
                      : isExtractingFile
                        ? "Lendo documento..."
                        : "Selecione um arquivo"}
                  </p>

                  <p className="text-sm text-muted-foreground">
                    Suportados aqui: JPG, PNG, PDF textual e DOCX. XLS/XLSX ficam para
                    importação estruturada.
                  </p>
                </div>

                <input
                  type="file"
                  accept="image/*,.pdf,.docx"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={isOcrProcessing || isExtractingFile}
                />

                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isOcrProcessing || isExtractingFile}
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Paperclip className="mr-2 h-4 w-4" /> Escolher Arquivo
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
                <Badge
                  variant={
                    parsed.confianca === "alta"
                      ? "default"
                      : parsed.confianca === "media"
                        ? "secondary"
                        : "destructive"
                  }
                >
                  IA: {parsed.confianca}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <FileText className="h-3 w-3" /> Origem: {sourceLabel}
              </Badge>

              <Badge variant="secondary" className="gap-1">
                <Check className="h-3 w-3" /> Estado: Sugerida
              </Badge>

              <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
                <Sparkles className="h-3 w-3" /> Escopo:{" "}
                {editForm.scope === "private"
                  ? "Pessoal"
                  : editForm.scope === "family"
                    ? "Família"
                    : "Negócio"}
              </Badge>
            </div>

            {parsed.camposFaltantes.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Campos não detectados</p>
                  <p className="text-xs">
                    A IA não encontrou com clareza: {parsed.camposFaltantes.join(", ")}
                  </p>
                </div>
              </div>
            )}

            {hasInstallment && (
              <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  <p className="font-semibold text-sm">
                    Parcelamento detectado: {parsed.installmentText}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  A primeira parcela é para este mês ou para o próximo mês?
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={installmentStart === "this_month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInstallmentStart("this_month")}
                  >
                    Neste mês
                  </Button>
                  <Button
                    variant={installmentStart === "next_month" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInstallmentStart("next_month")}
                  >
                    Próximo mês
                  </Button>
                </div>
                {installmentStart && (
                  <p className="text-xs text-muted-foreground">
                    ✓ {parsed.installmentCount} parcelas de{" "}
                    {parsed.valor
                      ? formatCurrency(Math.round((parsed.valor / parsed.installmentCount!) * 100) / 100)
                      : "valor a definir"}{" "}
                    — início: {installmentStart === "this_month" ? "este mês" : "próximo mês"}
                  </p>
                )}
              </div>
            )}


            {!isEditing ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Resumo da Sugestão</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor</Label>
                      <p className="text-2xl font-bold">
                        {parsed.valor ? formatCurrency(parsed.valor) : "Não detectado"}
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Tipo</Label>
                      <p className="font-medium">
                        {parsed.tipo === "income" ? "Receita" : "Despesa"}
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Descrição</Label>
                      <p className="font-medium">{parsed.descricao || "Não detectada"}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Data</Label>
                      <p className="font-medium">{parsed.data || "Não detectada"}</p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Categoria sugerida</Label>
                      <p className="font-medium">
                        {parsed.categoriaSugerida || "Não sugerida"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Observações e Evidências</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Texto original</Label>
                      <p className="rounded-md bg-muted p-3 text-sm">
                        {parsed.textoOriginal || textInput || "—"}
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Observações</Label>
                      <div className="space-y-2">
                        {parsed.observacoes.length > 0 ? (
                          parsed.observacoes.map((obs, idx) => {
                            const isFallbackWarning = obs.toLowerCase().includes("fallback local");

                            return (
                              <div
                                key={`${obs}-${idx}`}
                                className={`rounded-md border px-3 py-2 text-sm ${
                                  isFallbackWarning
                                    ? "border-amber-300 bg-amber-50 text-amber-900"
                                    : "border-muted bg-muted/40 text-muted-foreground"
                                }`}
                              >
                                {obs}
                              </div>
                            );
                          })
                        ) : (
                          <p className="rounded-md bg-muted p-2 text-sm">Sem observações.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="valor">Valor</Label>
                  <Input
                    id="valor"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={editForm.valor}
                    onChange={(e) => setEditForm((f) => ({ ...f, valor: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={editForm.tipo}
                    onValueChange={(value) => setEditForm((f) => ({ ...f, tipo: value }))}
                  >
                    <SelectTrigger id="tipo">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Despesa</SelectItem>
                      <SelectItem value="income">Receita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Input
                    id="descricao"
                    value={editForm.descricao}
                    onChange={(e) => setEditForm((f) => ({ ...f, descricao: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data">Data</Label>
                  <Input
                    id="data"
                    type="date"
                    value={editForm.data}
                    onChange={(e) => setEditForm((f) => ({ ...f, data: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria</Label>
                  <Select
                    value={editForm.categoria_id}
                    onValueChange={(value) =>
                      setEditForm((f) => ({ ...f, categoria_id: value }))
                    }
                  >
                    <SelectTrigger id="categoria">
                      <SelectValue placeholder="Selecionar categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="scope">Escopo</Label>
                  <Select
                    value={editForm.scope}
                    onValueChange={(value) => setEditForm((f) => ({ ...f, scope: value }))}
                    disabled={currentScope !== "all"}
                  >
                    <SelectTrigger id="scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">Pessoal</SelectItem>
                      <SelectItem value="family">Família</SelectItem>
                      <SelectItem value="business">Negócio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t bg-muted/20 pt-4 sm:flex-row sm:justify-end">
            {!isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="w-full sm:w-auto"
                >
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDiscard}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Descartar
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Confirmar e Salvar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="w-full sm:w-auto"
                >
                  Cancelar edição
                </Button>

                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full sm:w-auto"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar revisão
                </Button>
              </>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
