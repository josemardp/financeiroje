import { useAuth } from "@/contexts/AuthContext";
import { useScope } from "@/contexts/ScopeContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, X, Lightbulb, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DigestItem {
  icon: string;
  title: string;
  text: string;
}

interface DigestContent {
  observations: DigestItem[];
  recommendations: DigestItem[];
  celebrations: DigestItem[];
}

/**
 * WeeklyDigestCard — Componente passivo de inteligência semanal.
 * Exibe observações, sugestões e conquistas do último período analisado.
 */
export function WeeklyDigestCard() {
  const { user } = useAuth();
  const { currentScope } = useScope();
  const queryClient = useQueryClient();

  const { data: digest, isLoading } = useQuery({
    queryKey: ["weekly-digest", user?.id, currentScope],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_digests")
        .select("*")
        .eq("user_id", user?.id)
        .eq("scope", currentScope)
        .is("dismissed_at", null)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("weekly_digests")
        .update({
          dismissed_at: new Date().toISOString(),
          dismiss_reason: "this_week",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-digest"] });
    },
    onError: () => {
      toast.error("Erro ao ocultar o resumo.");
    }
  });

  if (isLoading || !digest) return null;

  const content = digest.content as unknown as DigestContent;

  return (
    <Card className="animate-in fade-in slide-in-from-top-4 border-none bg-muted/40 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Resumo da Semana</CardTitle>
          <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider ml-1">
            {format(parseISO(digest.week_start), "dd MMM", { locale: ptBR })} - {format(parseISO(digest.week_end), "dd MMM", { locale: ptBR })}
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-muted-foreground hover:text-foreground" 
          onClick={() => dismissMutation.mutate(digest.id)}
          title="Não mostrar esta semana"
        >
          <X className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent className="pb-4 px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Observações */}
          {content.observations?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                <Lightbulb className="h-3 w-3" /> Observações
              </div>
              <ul className="space-y-2">
                {content.observations.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="shrink-0 text-sm">{item.icon || "💡"}</span>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recomendações */}
          {content.recommendations?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                <Target className="h-3 w-3" /> Sugestões
              </div>
              <ul className="space-y-2">
                {content.recommendations.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="shrink-0 text-sm">{item.icon || "🎯"}</span>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Celebrações */}
          {content.celebrations?.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                <Trophy className="h-3 w-3" /> Conquistas
              </div>
              <ul className="space-y-2">
                {content.celebrations.map((item, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="shrink-0 text-sm">{item.icon || "🏆"}</span>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
