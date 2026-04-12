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
import { Star, Pencil, X, Save, Loader2 } from "lucide-react";
import { formatDistanceToNow, isPast, format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Tipos ──────────────────────────────────────────────────────────────────

type MemoryType =
  | "observation"
  | "preference"
  | "concern"
  | "goal_context"
  | "value_alignment";

interface CoachMemory {
  id: string;
  content: string;
  memory_type: MemoryType;
  relevance: number;
  reinforcement_count: number;
  last_reinforced_at: string;
  expires_at: string | null;
}

// ── Labels / variantes ─────────────────────────────────────────────────────

const TYPE_LABELS: Record<MemoryType, string> = {
  observation:     "Observação",
  preference:      "Preferência",
  concern:         "Preocupação",
  goal_context:    "Contexto de meta",
  value_alignment: "Valor pessoal",
};

const TYPE_VARIANT: Record<MemoryType, "default" | "secondary" | "outline" | "destructive"> = {
  observation:     "secondary",
  preference:      "default",
  concern:         "destructive",
  goal_context:    "outline",
  value_alignment: "outline",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function expiryLabel(expires_at: string | null): { text: string; expired: boolean } {
  if (!expires_at) return { text: "Permanente", expired: false };
  if (isPast(new Date(expires_at))) return { text: "Expirada", expired: true };
  return {
    text: `expira em ${format(new Date(expires_at), "dd/MM/yy", { locale: ptBR })}`,
    expired: false,
  };
}

// ── CoachMemoryList ────────────────────────────────────────────────────────

export default function CoachMemoryList() {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const queryClient = useQueryClient();

  const [filterType, setFilterType] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // ── Query ─────────────────────────────────────────────────────────────────

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["ai-memory-coach", currentScope],
    queryFn: async () => {
      let q = supabase
        .from("ai_coach_memory")
        .select("id, content, memory_type, relevance, reinforcement_count, last_reinforced_at, expires_at")
        .is("superseded_by", null)
        .order("last_reinforced_at", { ascending: false });
      if (currentScope !== "all") q = q.eq("scope", currentScope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CoachMemory[];
    },
    enabled: !!user,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  const promoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_coach_memory")
        .update({ memory_type: "preference", expires_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memory-coach", currentScope] });
      toast.success("Memória promovida a Preferência");
    },
    onError: () => toast.error("Erro ao promover memória"),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("ai_coach_memory")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memory-coach", currentScope] });
      setEditingId(null);
      toast.success("Memória atualizada");
    },
    onError: () => toast.error("Erro ao atualizar memória"),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function startEdit(m: CoachMemory) {
    setEditingId(m.id);
    setEditContent(m.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent("");
  }

  // ── Dados filtrados ───────────────────────────────────────────────────────

  const filtered =
    filterType === "all" ? memories : memories.filter((m) => m.memory_type === filterType);

  const availableTypes = Array.from(new Set(memories.map((m) => m.memory_type)));

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma memória registrada ainda. O Coach extrai memórias automaticamente das suas conversas.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtro */}
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
        <span className="text-xs text-muted-foreground">{filtered.length} memória(s)</span>
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {filtered.map((m) => {
          const expiry = expiryLabel(m.expires_at);
          return (
            <Card key={m.id} className={expiry.expired ? "opacity-60" : undefined}>
              <CardContent className="p-4 space-y-3">
                {/* Cabeçalho */}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={TYPE_VARIANT[m.memory_type]} className="text-xs">
                      {TYPE_LABELS[m.memory_type]}
                    </Badge>
                    {expiry.expired && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Expirada
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">★ {m.relevance}/10</span>
                  </div>

                  {/* Ações (ocultas durante edição) */}
                  {editingId !== m.id && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => startEdit(m)}
                        title="Editar conteúdo"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950"
                        onClick={() => promoteMutation.mutate(m.id)}
                        disabled={promoteMutation.isPending || m.memory_type === "preference"}
                        title="Sempre lembrar — promover a Preferência"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Conteúdo ou editor */}
                {editingId === m.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="text-sm min-h-20 resize-y"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm" className="h-7"
                        onClick={() => editMutation.mutate({ id: m.id, content: editContent })}
                        disabled={editMutation.isPending || editContent.trim().length === 0}
                      >
                        {editMutation.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          : <Save className="h-3.5 w-3.5 mr-1" />}
                        Salvar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed">{m.content}</p>
                )}

                {/* Rodapé */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Reforçada {m.reinforcement_count}×</span>
                  <span>
                    {formatDistanceToNow(new Date(m.last_reinforced_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                  <span className={expiry.expired ? "text-destructive" : undefined}>
                    {expiry.text}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
