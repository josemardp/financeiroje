import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ThumbsUp, ThumbsDown, Beaker, TrendingUp, AlertCircle, Info } from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

interface VariantStats {
  variantKey: string;
  totalMessages: number;
  upvotes: number;
  downvotes: number;
  score: number;
  conversionRate: number;
  confidenceInterval: [number, number];
}

interface Experiment {
  key: string;
  active: boolean;
  variants: VariantStats[];
}

/**
 * Calcula o Wilson Score Interval para um nível de confiança de 95% (z = 1.96).
 * Fornece um limite inferior mais robusto para amostras pequenas.
 */
function calculateWilsonScore(upvotes: number, total: number): [number, number] {
  if (total === 0) return [0, 0];
  const z = 1.96;
  const p = upvotes / total;
  const denominator = 1 + z * z / total;
  const center = p + z * z / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total);
  
  return [
    Math.max(0, (center - spread) / denominator),
    Math.min(1, (center + spread) / denominator)
  ];
}

export default function AIExperiments() {
  const { data: experiments, isLoading } = useQuery({
    queryKey: ["ai-experiments-stats"],
    queryFn: async () => {
      // 1. Buscar dados em paralelo
      const [variantsRes, messagesRes, feedbackRes] = await Promise.all([
        (supabase as any).from("prompt_variants").select("*").eq("active", true),
        (supabase as any).from("ai_messages").select("id, prompt_variant_keys").not("prompt_variant_keys", "is", null),
        (supabase as any).from("ai_self_observations").select("user_feedback, message_id").not("message_id", "is", null).not("user_feedback", "is", null)
      ]);

      if (variantsRes.error) throw variantsRes.error;
      if (messagesRes.error) throw messagesRes.error;
      if (feedbackRes.error) throw feedbackRes.error;

      const variantsData = variantsRes.data || [];
      const messagesData = messagesRes.data || [];
      const feedbackData = feedbackRes.data || [];

      // Criar mapa de feedback por message_id para cruzamento rápido
      const feedbackMap = new Map<string, string>();
      feedbackData.forEach((f: any) => {
        if (f.message_id && (f.user_feedback === "up" || f.user_feedback === "down")) {
          feedbackMap.set(f.message_id, f.user_feedback);
        }
      });

      // 2. Processar estatísticas consolidada
      const finalResult: Experiment[] = variantsData.map((exp: any) => {
        const variantOptions = Array.isArray(exp.variants) 
          ? exp.variants 
          : (exp.variants as any)?.options || [];
        
        const variantKeys = variantOptions.map((v: any) => 
          typeof v === "string" ? v : (v.key || v.variant_key)
        );

        const stats: VariantStats[] = variantKeys.map((vKey: string) => {
          const variantMessages = messagesData.filter((m: any) => {
            const keys = m.prompt_variant_keys as Record<string, string>;
            return keys && keys[exp.experiment_key] === vKey;
          });

          const total = variantMessages.length;
          let up = 0;
          let down = 0;

          variantMessages.forEach((m: any) => {
            const f = feedbackMap.get(m.id);
            if (f === "up") up++;
            if (f === "down") down++;
          });

          // Ajuste de integridade estatística (Sessão 7 - Revisão Final)
          // Usamos o total de mensagens como base para o Wilson Score
          const interval = calculateWilsonScore(up, total); 
          const score = total > 0 ? (up - down) / total : 0;
          const conversionRate = total > 0 ? (up / total) : 0;

          return {
            variantKey: vKey,
            totalMessages: total,
            upvotes: up,
            downvotes: down,
            score,
            conversionRate,
            confidenceInterval: interval
          };
        });

        return {
          key: exp.experiment_key,
          active: exp.active,
          variants: stats
        };
      });

      return finalResult;
    }
  });

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Laboratório de IA"
        description="Acompanhe a performance de experimentos A/B e variantes de prompt"
      >
        <Badge variant="outline" className="gap-1">
          <Beaker className="h-3 w-3" />
          Modo Experimental
        </Badge>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : experiments?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Beaker className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-medium">Nenhum experimento ativo</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Os experimentos A/B são definidos via prompt_variants no banco de dados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {experiments?.map((exp) => (
            <Card key={exp.key} className="overflow-hidden">
              <CardHeader className="bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {exp.key}
                      <Badge variant="secondary" className="text-[10px] uppercase">Ativo</Badge>
                    </CardTitle>
                    <CardDescription>
                      Comparação de performance entre variantes de prompt
                    </CardDescription>
                  </div>
                  <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Variante</TableHead>
                      <TableHead className="text-center">Mensagens</TableHead>
                      <TableHead className="text-center">Feedback</TableHead>
                      <TableHead className="text-center">Satisfação Líquida</TableHead>
                      <TableHead className="text-center">Confiança (Wilson)</TableHead>
                      <TableHead className="text-right pr-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exp.variants.map((v) => {
                      const otherVariants = exp.variants.filter(ov => ov.variantKey !== v.variantKey);
                      const maxOtherUB = otherVariants.length > 0 
                        ? Math.max(...otherVariants.map(ov => ov.confidenceInterval[1]))
                        : 0;
                      const minOtherLB = otherVariants.length > 0
                        ? Math.min(...otherVariants.map(ov => ov.confidenceInterval[0]))
                        : 0;
                      
                      const isWinner = exp.variants.length > 1 && v.confidenceInterval[0] > maxOtherUB && v.totalMessages > 10;
                      const isLoser = exp.variants.length > 1 && v.confidenceInterval[1] < minOtherLB && v.totalMessages > 10;
                      const isNarrow = (v.confidenceInterval[1] - v.confidenceInterval[0]) < 0.10 && v.totalMessages > 0;

                      return (
                        <TableRow key={v.variantKey}>
                          <TableCell className="font-medium pl-6">
                            {v.variantKey === "base" ? (
                              <div className="flex items-center gap-1.5">
                                {v.variantKey}
                                <Badge variant="outline" className="text-[9px] h-4">BASE</Badge>
                              </div>
                            ) : v.variantKey}
                          </TableCell>
                          <TableCell className="text-center">{v.totalMessages}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-3">
                              <span className="flex items-center gap-1 text-green-600 text-xs" title="Útil">
                                <ThumbsUp className="h-3 w-3" /> {v.upvotes}
                              </span>
                              <span className="flex items-center gap-1 text-destructive text-xs" title="Não útil">
                                <ThumbsDown className="h-3 w-3" /> {v.downvotes}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <span className="text-sm font-medium">{(v.score * 100).toFixed(1)}%</span>
                              <Progress value={Math.max(0, v.score * 100)} className="h-1" />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-[10px] font-mono text-muted-foreground">
                              [{(v.confidenceInterval[0] * 100).toFixed(1)}% - {(v.confidenceInterval[1] * 100).toFixed(1)}%]
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {isWinner ? (
                              <Badge className="bg-green-600">VENCEDOR</Badge>
                            ) : isLoser ? (
                              <Badge variant="destructive">INFERIOR</Badge>
                            ) : isNarrow ? (
                              <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">ESTÁVEL</Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">INCONCLUSIVO</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="p-4 bg-muted/10 border-t flex items-start gap-3">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      <strong> Satisfação Líquida:</strong> (Útil - Não útil) / Total de Mensagens. Reflete o valor real entregue por cada interação desta variante.
                    </p>
                    <p>
                      <strong> Wilson Score Interval:</strong> Intervalo estatístico com 95% de confiança. Uma variante é declarada vencedora apenas se seu limite inferior for estatisticamente superior aos limites de todas as demais.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 p-4 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-800 text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <p>
          A promoção de variantes (tornar uma variante a nova base) deve ser feita via atualização manual no catálogo de prompts ou configuração de código, 
          após validação estatística neste painel.
        </p>
      </div>
    </div>
  );
}
