import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckCircle2, Trash2, Pencil, X, Save, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Tipos ────────────────────────────────────────────────────────────────────

type PatternType =
  | "merchant_category"
  | "description_normalization"
  | "counterparty_alias"
  | "recurring_amount"
  | "category_value_range"
  | "time_pattern"
  | "document_disambiguation";

type PatternSource = "observed" | "corrected" | "declared";

interface UserPattern {
  id: string;
  pattern_type: PatternType;
  pattern_key: string;
  pattern_value: Record<string, unknown>;
  confidence: number;
  hit_count: number;
  source: PatternSource;
  last_seen_at: string;
}

// ── Labels ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<PatternType, string> = {
  merchant_category:         "Loja → Categoria",
  description_normalization: "Normalização",
  counterparty_alias:        "Alias",
  recurring_amount:          "Recorrência",
  category_value_range:      "Faixa de valor",
  time_pattern:              "Padrão horário",
  document_disambiguation:   "Documento",
};

const SOURCE_LABELS: Record<PatternSource, string> = {
  observed: "Observado",
  corrected: "Corrigido",
  declared: "Declarado",
};

// ── ConfidenceBar ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value < 0.4 ? "bg-destructive" :
    value < 0.7 ? "bg-yellow-500"  :
    "bg-green-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums">{pct}%</span>
    </div>
  );
}

// ── PatternsList ─────────────────────────────────────────────────────────────

export default function PatternsList() {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const queryClient = useQueryClient();

  const [filterType, setFilterType] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editJson, setEditJson] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);

  // ── Query ─────────────────────────────────────────────────────────────────

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ["ai-memory-patterns", currentScope],
    queryFn: async () => {
      let q = supabase
        .from("user_patterns")
        .select("id, pattern_type, pattern_key, pattern_value, confidence, hit_count, source, last_seen_at")
        .order("last_seen_at", { ascending: false });
      if (currentScope !== "all") q = q.eq("scope", currentScope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UserPattern[];
    },
    enabled: !!user,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_patterns")
        .update({ confidence: 1.0, source: "declared" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memory-patterns", currentScope] });
      toast.success("Padrão aprovado");
    },
    onError: () => toast.error("Erro ao aprovar padrão"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_patterns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memory-patterns", currentScope] });
      toast.success("Padrão removido");
    },
    onError: () => toast.error("Erro ao remover padrão"),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: unknown }) => {
      const { error } = await supabase
        .from("user_patterns")
        .update({ pattern_value: value })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memory-patterns", currentScope] });
      setEditingId(null);
      toast.success("Padrão atualizado");
    },
    onError: () => toast.error("Erro ao atualizar padrão"),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function startEdit(p: UserPattern) {
    setEditingId(p.id);
    setEditJson(JSON.stringify(p.pattern_value, null, 2));
    setJsonError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditJson("");
    setJsonError(null);
  }

  function handleSaveEdit(id: string) {
    try {
      const parsed = JSON.parse(editJson);
      editMutation.mutate({ id, value: parsed });
    } catch {
      setJsonError("JSON inválido — verifique a sintaxe antes de salvar.");
    }
  }

  // ── Dados filtrados ───────────────────────────────────────────────────────

  const filtered =
    filterType === "all" ? patterns : patterns.filter((p) => p.pattern_type === filterType);

  const availableTypes = Array.from(new Set(patterns.map((p) => p.pattern_type)));

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum padrão aprendido ainda. Os padrões são extraídos conforme você usa a Captura Inteligente.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtro por tipo */}
      <div className="flex items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Todos os tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {availableTypes.map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} padrão(ões)</span>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-4 space-y-3">
              {/* Cabeçalho */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[p.pattern_type]}</Badge>
                    <Badge
                      variant={p.source === "declared" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {SOURCE_LABELS[p.source]}
                    </Badge>
                  </div>
                  <p className="font-mono text-sm font-medium truncate">{p.pattern_key}</p>
                </div>

                {/* Botões de ação (ocultos enquanto edita) */}
                {editingId !== p.id && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => startEdit(p)}
                      title="Editar valor JSON"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                      onClick={() => approveMutation.mutate(p.id)}
                      disabled={approveMutation.isPending || p.source === "declared"}
                      title="Aprovar — marcar como declarado"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                      title="Recusar e remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Métricas */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>Confiança:</span>
                  <ConfidenceBar value={p.confidence} />
                </div>
                <span>Usado {p.hit_count}×</span>
                <span>
                  {formatDistanceToNow(new Date(p.last_seen_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>

              {/* Editor inline ou visualização do valor */}
              {editingId === p.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editJson}
                    onChange={(e) => {
                      setEditJson(e.target.value);
                      setJsonError(null);
                    }}
                    className="font-mono text-xs min-h-28 resize-y"
                    spellCheck={false}
                  />
                  {jsonError && (
                    <p className="text-xs text-destructive">{jsonError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm" className="h-7"
                      onClick={() => handleSaveEdit(p.id)}
                      disabled={editMutation.isPending}
                    >
                      {editMutation.isPending
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        : <Save className="h-3.5 w-3.5 mr-1" />}
                      Salvar
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7"
                      onClick={cancelEdit}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <pre className="rounded-md bg-muted px-3 py-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(p.pattern_value, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
