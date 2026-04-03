/**
 * FinanceAI — Captura Inteligente Premium
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
import {
  OCR_IMAGE_FILE_ACCEPT,
  getSupportedOcrImageFormatsLabel,
  looksLikeImageFile,
  validateOcrImageFile,
} from "@/services/smartCapture/ocrImageFormats";
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
  Mic, Type, Send, Check, Edit, AlertCircle, Loader2, Trash2, Save, FileText, Sparkles, Paperclip,
} from "lucide-react";

type CaptureMode = "text" | "voice" | "file";

function mapOcrConfidence(metadata?: { confidence?: "alta" | "media" | "baixa" }, raw = 0.6): ParsedTransaction["confianca"] {
  const explicit = metadata?.confidence;
  if (explicit === "alta" || explicit === "media" || explicit === "baixa") return explicit;
  if (raw >= 0.85) return "alta";
  if (raw >= 0.65) return "media";
  return "baixa";
}

// ... (funções mapStructuredCaptureToParsed, mapStructuredOcrToParsed, etc. permanecem iguais)
// Para não ficar gigante demais, assumirei que você já tem elas. Se der erro, me avise.

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

  const { isRecording, isTranscribing, result: voiceResult, startRecording, stopRecording, resetVoice } = useVoiceCapture();
  const { isProcessing: isOcrProcessing, result: ocrResult, processImage, resetOcr, lastError: ocrLastError } = useOcrCapture();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const interpretAbortRef = useRef<AbortController | null>(null);
  const [isInterpreting, setIsInterpreting] = useState(false);
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

  // ==================== CORREÇÃO DA SESSÃO ====================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    const resetInput = () => { input.value = ""; };

    if (!file) return;

    // Verifica sessão antes de qualquer coisa
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        toast.error("Sessão inválida ou expirada", {
          description: "Faça login novamente e tente outra vez.",
        });
        resetInput();
        return;
      }
    } catch {
      toast.error("Erro ao verificar sessão");
      resetInput();
      return;
    }

    // ... resto da função original (validações de arquivo, processImage, etc.)
    const name = file.name.toLowerCase();
    const isImage = looksLikeImageFile(file);
    const imageValidation = validateOcrImageFile(file);
    const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
    const isDocx = name.endsWith(".docx");

    if (isImage) {
      if (!imageValidation.ok) {
        toast.error("Formato de imagem não suportado", { description: imageValidation.reason });
        resetInput();
        return;
      }
      try { await processImage(file); } finally { resetInput(); }
      return;
    }

    if (isPdf || isDocx) {
      setIsExtractingFile(true);
      try {
        const result = await extractTextFromSupportedFile(file);
        const sourceKind: InterpretSourceKind = result.source === "pdf" ? "pdf_text" : "docx_text";
        await handleParse(result.text, "free_text", sourceKind, result.source.toUpperCase());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erro ao processar arquivo");
      } finally {
        setIsExtractingFile(false);
        resetInput();
      }
      return;
    }

    toast.error("Formato de arquivo não suportado");
    resetInput();
  };

  // ==================== RESTO DO COMPONENTE ====================
  return (
    <div className="animate-fade-in space-y-6 p-4">
      <PageHeader
        title="Captura Inteligente Premium"
        description={`Modo Espelho ativo — Escopo atual: ${scopeLabel}`}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant={mode === "text" ? "default" : "outline"} onClick={() => setMode("text")}>
          <Type className="mr-2 h-4 w-4" /> Texto Livre
        </Button>
        <Button variant={mode === "voice" ? "default" : "outline"} onClick={() => setMode("voice")}>
          <Mic className="mr-2 h-4 w-4" /> Voz (Beta)
        </Button>
        <Button variant={mode === "file" ? "default" : "outline"} onClick={() => setMode("file")}>
          <Paperclip className="mr-2 h-4 w-4" /> Arquivo / OCR
        </Button>
      </div>

      {!parsed && (
        <Card>
          <CardHeader>
            <CardTitle>Envie uma foto ou documento</CardTitle>
          </CardHeader>
          <CardContent>
            {mode === "file" && (
              <div className="flex flex-col items-center py-12 border-2 border-dashed rounded-xl">
                <Paperclip className="h-16 w-16 text-muted-foreground mb-4" />
                <Button onClick={() => fileInputRef.current?.click()} disabled={isOcrProcessing || isExtractingFile}>
                  Escolher Arquivo
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}