import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  decisionId: string;
}

export function DecisionResponseButtons({ decisionId }: Props) {
  const [responded, setResponded] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(response: "accepted" | "postponed" | "rejected", noteText?: string) {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("mark_decision_response" as any, {
        p_decision_id: decisionId,
        p_response:    response,
        p_note:        noteText ?? null,
      });
      if (error) throw error;
      setResponded(true);
      setShowNote(false);
    } catch {
      toast.error("Erro ao registrar resposta");
    } finally {
      setSaving(false);
    }
  }

  if (responded) {
    return <span className="text-xs text-muted-foreground">Resposta registrada.</span>;
  }

  return (
    <div className="space-y-2">
      {!showNote && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground">Esse conselho:</span>
          <Button
            variant="outline" size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => submit("accepted")}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "✅"} Vou seguir
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-7 text-xs"
            onClick={() => submit("postponed")}
            disabled={saving}
          >
            ⏸ Depois
          </Button>
          <Button
            variant="outline" size="sm"
            className="h-7 text-xs"
            onClick={() => setShowNote(true)}
            disabled={saving}
          >
            ❌ Não vou seguir
          </Button>
        </div>
      )}

      {showNote && (
        <div className="space-y-2 max-w-sm">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Por quê? (opcional)"
            className="text-xs min-h-14 resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm" className="h-7"
              onClick={() => submit("rejected", note.trim() || undefined)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Confirmar
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7"
              onClick={() => setShowNote(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
