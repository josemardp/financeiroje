import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface CaptureEvent {
  id: string;
  created_at: string;
  source_type: string;
  raw_input: string | null;
  corrected_fields: string[];
  accepted_fields: string[];
  confidence_before: number | null;
  time_in_mirror_ms: number | null;
}

// ── Labels / helpers ───────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  text:  "Texto",
  audio: "Áudio",
  photo: "Foto",
  ocr:   "OCR",
  pdf:   "PDF",
  word:  "Word",
  excel: "Excel",
};

const FIELD_LABELS: Record<string, string> = {
  categoria_id: "categoria",
  valor:        "valor",
  descricao:    "descrição",
  data:         "data",
  tipo:         "tipo",
  scope:        "escopo",
  e_mei:        "MEI",
};

function fieldLabel(f: string): string {
  return FIELD_LABELS[f] ?? f;
}

function formatMirrorTime(ms: number | null): string | null {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${s}s no espelho`;
}

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

// ── CaptureHistoryList ─────────────────────────────────────────────────────

export default function CaptureHistoryList() {
  const { user } = useAuth();
  const { currentScope } = useScope();

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["capture-history", currentScope],
    queryFn: async () => {
      let q = supabase
        .from("capture_learning_events")
        .select("id, created_at, source_type, raw_input, corrected_fields, accepted_fields, confidence_before, time_in_mirror_ms")
        .order("created_at", { ascending: false })
        .limit(50);
      if (currentScope !== "all") q = q.eq("scope", currentScope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as CaptureEvent[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma captura registrada ainda. O histórico aparece após o uso da Captura Inteligente.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((e) => {
        const mirrorTime = formatMirrorTime(e.time_in_mirror_ms);
        const hasCorrected = e.corrected_fields.length > 0;

        return (
          <Card key={e.id}>
            <CardContent className="p-4 space-y-3">
              {/* Linha 1 — origem + data + tempo espelho */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {SOURCE_LABELS[e.source_type] ?? e.source_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(e.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
                {mirrorTime && (
                  <span className="text-xs text-muted-foreground">{mirrorTime}</span>
                )}
              </div>

              {/* Linha 2 — raw_input truncado */}
              {e.raw_input && (
                <p className="text-sm text-muted-foreground font-mono truncate">
                  {e.raw_input.length > 80
                    ? `${e.raw_input.slice(0, 80)}…`
                    : e.raw_input}
                </p>
              )}

              {/* Linha 3 — confiança inicial */}
              {e.confidence_before !== null && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Confiança inicial:</span>
                  <ConfidenceBar value={e.confidence_before} />
                </div>
              )}

              {/* Linha 4 — campos corrigidos e aceitos */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {hasCorrected ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>Corrigido:</span>
                    {e.corrected_fields.map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs">
                        {fieldLabel(f)}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Sem correções</span>
                  </div>
                )}
                {e.accepted_fields.length > 0 && (
                  <span className="text-muted-foreground">
                    · Aceito: {e.accepted_fields.length} campo(s)
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
