import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  messageId: string;
  contextUsedIds: { memories: string[]; patterns: string[] };
}

export function ResponseFeedback({ messageId, contextUsedIds }: Props) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submitFeedback(value: "up" | "down", commentText: string | null) {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("apply_response_feedback", {
        p_message_id:  messageId,
        p_rating:      value,
        p_pattern_ids: contextUsedIds.patterns,
        p_memory_ids:  contextUsedIds.memories,
        p_comment:     commentText ?? null,
      });
      if (error) throw error;
      setSaved(true);
      setShowComment(false);
    } catch {
      toast.error("Erro ao registrar feedback");
    } finally {
      setSaving(false);
    }
  }

  function handleThumbsUp() {
    if (saved) return;
    setRating("up");
    submitFeedback("up", null);
  }

  function handleThumbsDown() {
    if (saved) return;
    setRating("down");
    setShowComment(true);
  }

  function handleSubmitComment() {
    submitFeedback("down", comment.trim() || null);
  }

  if (saved) {
    return (
      <span className="text-xs text-muted-foreground">
        {rating === "up" ? "Obrigado pelo feedback!" : "Feedback registrado."}
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${rating === "up" ? "text-green-600" : "text-muted-foreground hover:text-foreground"}`}
          onClick={handleThumbsUp}
          disabled={saving}
          title="Resposta útil"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="sm"
          className={`h-7 w-7 p-0 ${rating === "down" ? "text-destructive" : "text-muted-foreground hover:text-foreground"}`}
          onClick={handleThumbsDown}
          disabled={saving}
          title="Resposta não útil"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showComment && (
        <div className="space-y-2 max-w-sm">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="O que poderia ter sido melhor? (opcional)"
            className="text-xs min-h-16 resize-none"
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              size="sm" className="h-7"
              onClick={handleSubmitComment}
              disabled={saving}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Enviar
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7"
              onClick={() => { setShowComment(false); setRating(null); }}
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
