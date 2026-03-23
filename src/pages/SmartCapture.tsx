/**
 * FinanceAI — Captura Inteligente (Smart Capture)
 * Modo Espelho: usuário digita texto livre → parser extrai → card de confirmação → salva só após aprovação
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseTransactionText, type ParsedTransaction } from "@/services/smartCapture";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataStatusBadge } from "@/components/shared/DataStatusBadge";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Mic, Camera, Type, Send, Check, X, Edit, AlertCircle, Loader2 } from "lucide-react";

type CaptureMode = "text" | "voice" | "photo";

export default function SmartCapture() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<CaptureMode>("text");
  const [textInput, setTextInput] = useState("");
  const [parsed, setParsed] = useState<ParsedTransaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields for mirror mode
  const [editForm, setEditForm] = useState({
    valor: "",
    tipo: "expense" as string,
    descricao: "",
    data: "",
    categoria_id: "",
    scope: "private",
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("nome");
      return data || [];
    },
  });

  const handleParse = () => {
    if (!textInput.trim()) return;
    const result = parseTransactionText(textInput);
    setParsed(result);
    setIsEditing(false);
    setEditForm({
      valor: result.valor?.toString() || "",
      tipo: result.tipo,
      descricao: result.descricao,
      data: result.data,
      categoria_id: "",
      scope: result.escopo,
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
      source_type: "free_text" as any,
      confidence: parsed?.confianca as any || "media",
      created_by: user.id,
      validation_notes: `Texto original: "${parsed?.textoOriginal || textInput}"`,
    });

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Transação registrada como sugerida", {
        description: "Confirme na página de transações para incluir nos cálculos oficiais.",
      });
      setParsed(null);
      setTextInput("");
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    }
    setIsSaving(false);
  };

  const handleDiscard = () => {
    setParsed(null);
    setTextInput("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Captura Inteligente"
        description="Registre transações por texto, voz ou foto — sempre com confirmação"
      />

      {/* Mode selector */}
      <div className="flex gap-2">
        <Button variant={mode === "text" ? "default" : "outline"} size="sm" onClick={() => setMode("text")}>
          <Type className="h-4 w-4 mr-1" /> Texto
        </Button>
        <Button variant="outline" size="sm" disabled title="Em breve">
          <Mic className="h-4 w-4 mr-1" /> Voz
        </Button>
        <Button variant="outline" size="sm" disabled title="Em breve">
          <Camera className="h-4 w-4 mr-1" /> Foto
        </Button>
      </div>

      {/* Text input */}
      {mode === "text" && !parsed && (
        <Card>
          <CardHeader><CardTitle className="text-base">Descreva a transação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder='Ex: "gastei 52 reais com pizza hoje" ou "mercado 320 ontem" ou "entrou 4500 de salário"'
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={3}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleParse(); } }}
            />
            <Button onClick={handleParse} disabled={!textInput.trim()}>
              <Send className="h-4 w-4 mr-1" /> Interpretar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Mirror Mode — Confirmation Card */}
      {parsed && (
        <Card className="border-2 border-[hsl(var(--status-suggested))]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Modo Espelho — Confirme os dados</CardTitle>
                <DataStatusBadge status="suggested" />
              </div>
              <Badge variant="outline" className="text-xs">
                Confiança: {parsed.confianca}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Texto original: "{parsed.textoOriginal}"
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsed.camposFaltantes.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-[hsl(var(--warning))] bg-[hsl(var(--warning)/0.1)] rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Campos não detectados: {parsed.camposFaltantes.join(", ")}</span>
              </div>
            )}

            {parsed.observacoes.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-1">
                {parsed.observacoes.map((obs, i) => <p key={i}>ℹ️ {obs}</p>)}
              </div>
            )}

            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input type="number" step="0.01" value={editForm.valor}
                      onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={editForm.tipo} onValueChange={v => setEditForm(f => ({ ...f, tipo: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descrição</Label>
                  <Input value={editForm.descricao}
                    onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={editForm.data}
                      onChange={e => setEditForm(f => ({ ...f, data: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Categoria</Label>
                    <Select value={editForm.categoria_id} onValueChange={v => setEditForm(f => ({ ...f, categoria_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="..." /></SelectTrigger>
                      <SelectContent>
                        {(categories || []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Escopo</Label>
                    <Select value={editForm.scope} onValueChange={v => setEditForm(f => ({ ...f, scope: v }))}>
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
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Valor" value={parsed.valor ? formatCurrency(parsed.valor) : "Não detectado"} />
                <InfoRow label="Tipo" value={parsed.tipo === "income" ? "Receita" : "Despesa"} />
                <InfoRow label="Descrição" value={editForm.descricao || "—"} />
                <InfoRow label="Data" value={editForm.data} />
                <InfoRow label="Categoria sugerida" value={parsed.categoriaSugerida || "Não detectada"} />
                <InfoRow label="Escopo" value={editForm.scope === "private" ? "Pessoal" : editForm.scope === "family" ? "Família" : "Negócio"} />
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={isSaving || !editForm.valor} className="flex-1">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Salvar como sugerida
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(!isEditing)}>
                <Edit className="h-4 w-4 mr-1" /> {isEditing ? "Ver resumo" : "Editar"}
              </Button>
              <Button variant="ghost" onClick={handleDiscard}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground text-center">
              Será salva com status "sugerida". Confirme em Transações para incluir nos cálculos oficiais.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
