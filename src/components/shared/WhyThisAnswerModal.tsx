import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Info } from "lucide-react";

interface Props {
  contextUsedIds: { memories: string[]; patterns: string[] };
}

const MEMORY_TYPE_LABELS: Record<string, string> = {
  observation:     "Observação",
  preference:      "Preferência",
  concern:         "Preocupação",
  goal_context:    "Contexto de meta",
  value_alignment: "Valor pessoal",
};

export function WhyThisAnswerModal({ contextUsedIds }: Props) {
  const [open, setOpen] = useState(false);

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["why-modal-memories", contextUsedIds.memories],
    queryFn: async () => {
      if (!contextUsedIds.memories.length) return [];
      const { data, error } = await supabase
        .from("ai_coach_memory")
        .select("id, content, memory_type")
        .in("id", contextUsedIds.memories);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && contextUsedIds.memories.length > 0,
  });

  const hasContext =
    contextUsedIds.memories.length > 0 || contextUsedIds.patterns.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost" size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Por que a IA sugeriu isso?"
        >
          <Info className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Por que a IA sugeriu isso?</DialogTitle>
        </DialogHeader>

        {!hasContext ? (
          <p className="text-sm text-muted-foreground">
            Resposta gerada sem memórias ou padrões específicos (cache ou contexto vazio).
          </p>
        ) : isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {memories.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Memórias injetadas ({memories.length})
                </p>
                <ul className="space-y-2">
                  {memories.map((m) => (
                    <li key={m.id} className="space-y-1">
                      <Badge variant="outline" className="text-xs">
                        {MEMORY_TYPE_LABELS[m.memory_type as string] ?? m.memory_type}
                      </Badge>
                      <p className="text-sm leading-snug">{m.content}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {contextUsedIds.patterns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Padrões usados ({contextUsedIds.patterns.length})
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  IDs: {contextUsedIds.patterns.join(", ")}
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
