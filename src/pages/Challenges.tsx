import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { useScreenTracking } from "@/services/telemetry/useBehaviorTracking";

interface ChallengeRow {
  id: string;
  title: string;
  description: string;
  icon: string | null;
  duration_days: number;
}

interface ActiveGoal {
  id: string;
  notas: string | null;
  prazo: string | null;
}

export default function Challenges() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  useScreenTracking("Challenges");

  const { data: catalog, isLoading: loadingCatalog } = useQuery({
    queryKey: ["challenges-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges_catalog")
        .select("id, title, description, icon, duration_days")
        .order("duration_days", { ascending: true });
      if (error) throw error;
      return (data || []) as ChallengeRow[];
    },
    enabled: !!user,
  });

  const { data: activeGoals, isLoading: loadingGoals } = useQuery({
    queryKey: ["challenge-goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, notas, prazo")
        .ilike("notas", "challenge:%")
        .eq("ativo", true);
      if (error) throw error;
      return (data || []) as ActiveGoal[];
    },
    enabled: !!user,
  });

  const activateMutation = useMutation({
    mutationFn: async (challenge: ChallengeRow) => {
      if (!user) throw new Error("Não autenticado");
      const prazo = new Date();
      prazo.setDate(prazo.getDate() + challenge.duration_days);
      const { error } = await supabase.from("goals").insert({
        user_id: user.id,
        nome: challenge.title,
        valor_alvo: 0,
        valor_atual: 0,
        prazo: prazo.toISOString().split("T")[0],
        prioridade: "baixa",
        scope: "private",
        notas: `challenge:${challenge.id}`,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: (_, challenge) => {
      queryClient.invalidateQueries({ queryKey: ["challenge-goals"] });
      toast.success(`Desafio ativado: ${challenge.title}`);
    },
    onError: () => toast.error("Erro ao ativar desafio"),
  });

  const concludeMutation = useMutation({
    mutationFn: async (goalId: string) => {
      const { error } = await supabase
        .from("goals")
        .update({ ativo: false })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["challenge-goals"] });
      toast.success("Desafio encerrado");
    },
    onError: () => toast.error("Erro ao encerrar desafio"),
  });

  const activeMap = new Map(
    (activeGoals || []).map((g) => [
      g.notas?.replace("challenge:", "") ?? "",
      g,
    ])
  );

  const isLoading = loadingCatalog || loadingGoals;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Desafios"
        description="Pratique hábitos financeiros por um tempo definido. Ative quando quiser."
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {(catalog || []).map((c) => {
            const active = activeMap.get(c.id);
            return (
              <Card key={c.id} className={active ? "border-primary/40 bg-primary/5" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <span className="text-xl">{c.icon ?? "🎯"}</span>
                      {c.title}
                    </CardTitle>
                    <Badge variant={active ? "default" : "secondary"} className="shrink-0">
                      {active ? "Em andamento" : "Disponível"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{c.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Duração: {c.duration_days} dias
                    {active?.prazo ? ` · Prazo: ${formatDate(active.prazo)}` : ""}
                  </p>
                  {active ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => concludeMutation.mutate(active.id)}
                      disabled={concludeMutation.isPending}
                    >
                      {concludeMutation.isPending && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      Encerrar desafio
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => activateMutation.mutate(c)}
                      disabled={activateMutation.isPending}
                    >
                      {activateMutation.isPending && (
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      )}
                      Ativar desafio
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
