import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/format";
import { calculateGoalProgress } from "@/services/financeEngine";
import type { GoalRaw, GoalContributionRaw } from "@/services/financeEngine/types";
import { toast } from "sonner";
import { Plus, Target, Loader2, Trash2, PiggyBank, AlertTriangle, CheckCircle, Pencil } from "lucide-react";

export default function Goals() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [contributionGoalId, setContributionGoalId] = useState<string | null>(null);
  const [contributionValue, setContributionValue] = useState("");

  const { data: goals, isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data } = await supabase.from("goals").select("*").eq("ativo", true).order("prioridade");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: contributions } = useQuery({
    queryKey: ["goal-contributions"],
    queryFn: async () => {
      const { data } = await supabase.from("goal_contributions").select("*").order("data", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Meta removida");
    },
  });

  const addContribution = useMutation({
    mutationFn: async ({ goalId, valor }: { goalId: string; valor: number }) => {
      if (!user) throw new Error("Not authenticated");
      const { error: contribError } = await supabase.from("goal_contributions").insert({
        user_id: user.id, goal_id: goalId, valor, data: new Date().toISOString().split("T")[0],
      });
      if (contribError) throw contribError;
      const goal = goals?.find((g: any) => g.id === goalId);
      if (goal) {
        await supabase.from("goals").update({ valor_atual: Number(goal.valor_atual || 0) + valor }).eq("id", goalId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["goal-contributions"] });
      setContributionGoalId(null);
      setContributionValue("");
      toast.success("Aporte registrado!");
    },
    onError: () => toast.error("Erro ao registrar aporte"),
  });

  const { data: goalsWithProgress = [] } = useQuery({
    queryKey: ["goals-progress", goals, contributions],
    queryFn: async () => {
      if (!goals) return [];
      const allGoalRaws: GoalRaw[] = (goals || []).map((g: any) => ({
        id: g.id, nome: g.nome, valor_alvo: Number(g.valor_alvo), valor_atual: Number(g.valor_atual || 0), prazo: g.prazo, prioridade: g.prioridade, ativo: g.ativo,
      }));
      const allContribs: GoalContributionRaw[] = (contributions || []).map((c: any) => ({
        id: c.id, goal_id: c.goal_id, valor: Number(c.valor), data: c.data,
      }));
      const progressResults = await calculateGoalProgress(allGoalRaws, allContribs);
      return (goals || []).map((g: any) => ({ ...g, progress: progressResults.find((p) => p.goalId === g.id) }));
    },
    enabled: !!goals && !!contributions,
  });

  const PRIORITY_LABELS: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
  const PRIORITY_COLORS: Record<string, string> = { alta: "destructive", media: "default", baixa: "secondary" };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Metas & Sonhos" description="Acompanhe seus objetivos financeiros">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto"><Plus className="mr-1 h-4 w-4" /> Nova meta</Button>
          </DialogTrigger>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
            <DialogHeader><DialogTitle>Nova Meta</DialogTitle></DialogHeader>
            <GoalForm onSuccess={() => { setIsOpen(false); queryClient.invalidateQueries({ queryKey: ["goals"] }); }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : goalsWithProgress.length === 0 ? (
        <EmptyState icon={Target} title="Sem metas cadastradas" description="Cadastre seus sonhos e metas para acompanhar o progresso.">
          <Button onClick={() => setIsOpen(true)}><Plus className="mr-1 h-4 w-4" /> Criar meta</Button>
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goalsWithProgress.map((g: any) => {
            const p = g.progress;
            return (
              <Card key={g.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-sm leading-tight">
                      {p.isOnTrack ? <CheckCircle className="h-4 w-4 shrink-0 text-success" /> : <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />}
                      <span className="line-clamp-2">{g.nome}</span>
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={PRIORITY_COLORS[g.prioridade] as any}>{PRIORITY_LABELS[g.prioridade] || "Média"}</Badge>
                      <ScopeBadge scope={g.scope} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{formatCurrency(Number(g.valor_atual || 0))}</span>
                      <span className="font-medium">{formatCurrency(Number(g.valor_alvo))}</span>
                    </div>
                    <Progress value={p.progressPercent} className="h-2" />
                    <p className="mt-1 text-xs text-muted-foreground">{p.progressPercent.toFixed(1)}% concluído</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                    <div><span className="text-muted-foreground">Falta: </span><span className="font-medium">{formatCurrency(p.remainingAmount)}</span></div>
                    {p.monthlyContributionNeeded !== null && (
                      <div><span className="text-muted-foreground">Mensal: </span><span className="font-medium">{formatCurrency(p.monthlyContributionNeeded)}</span></div>
                    )}
                    {g.prazo && (
                      <div><span className="text-muted-foreground">Prazo: </span><span className="font-medium">{formatDate(g.prazo)}</span></div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Status: </span>
                      <span className={`font-medium ${p.isOnTrack ? "text-success" : "text-warning"}`}>{p.isOnTrack ? "No prazo" : "Em risco"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {contributionGoalId === g.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input type="number" step="0.01" min="0.01" placeholder="Valor" value={contributionValue} onChange={(e) => setContributionValue(e.target.value)} className="flex-1" />
                        <div className="flex gap-2 sm:w-auto">
                          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => {
                            const v = Number(contributionValue);
                            if (v > 0) addContribution.mutate({ goalId: g.id, valor: v });
                          }}>OK</Button>
                          <Button size="sm" variant="ghost" className="flex-1 sm:flex-none" onClick={() => setContributionGoalId(null)}>✕</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button size="sm" variant="outline" className="w-full sm:flex-1" onClick={() => setContributionGoalId(g.id)}>
                          <PiggyBank className="mr-1 h-3 w-3" /> Aportar
                        </Button>
                        <div className="flex items-center gap-2 sm:w-auto">
                          <Button size="sm" variant="ghost" className="flex-1 text-muted-foreground sm:flex-none" onClick={() => setEditingGoal(g)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="flex-1 text-muted-foreground hover:text-destructive sm:flex-none" onClick={() => deleteMutation.mutate(g.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader><DialogTitle>Editar Meta</DialogTitle></DialogHeader>
          {editingGoal && <GoalForm initialData={editingGoal} onSuccess={() => { setEditingGoal(null); queryClient.invalidateQueries({ queryKey: ["goals"] }); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoalForm({ onSuccess, initialData }: { onSuccess: () => void; initialData?: any }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    nome: initialData?.nome || "",
    valor_alvo: initialData?.valor_alvo?.toString() || "",
    prazo: initialData?.prazo || "",
    prioridade: initialData?.prioridade || "media",
    scope: initialData?.scope || "family",
    notas: initialData?.notas || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.nome.trim() || !form.valor_alvo) { toast.error("Preencha nome e valor"); return; }
    setSubmitting(true);

    const payload = {
      user_id: user.id,
      nome: form.nome.trim(),
      valor_alvo: Number(form.valor_alvo),
      prazo: form.prazo || null,
      prioridade: form.prioridade as any,
      scope: form.scope as any,
      notas: form.notas || null,
    };

    const { error } = initialData ? await supabase.from("goals").update(payload).eq("id", initialData.id) : await supabase.from("goals").insert({ ...payload, valor_atual: 0 });

    if (error) toast.error(initialData ? "Erro ao atualizar meta" : "Erro ao criar meta");
    else {
      toast.success(initialData ? "Meta atualizada!" : "Meta criada!");
      onSuccess();
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Nome do sonho/meta</Label><Input placeholder="Ex: Viagem para Europa, Reserva..." value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} required /></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Valor alvo (R$)</Label><Input type="number" step="0.01" min="1" value={form.valor_alvo} onChange={(e) => setForm((f) => ({ ...f, valor_alvo: e.target.value }))} required /></div>
        <div className="space-y-2"><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))} /></div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Prioridade</Label><Select value={form.prioridade} onValueChange={(v) => setForm((f) => ({ ...f, prioridade: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Média</SelectItem><SelectItem value="baixa">Baixa</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Escopo</Label><Select value={form.scope} onValueChange={(v) => setForm((f) => ({ ...f, scope: v as "private" | "family" | "business" }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Pessoal</SelectItem><SelectItem value="family">Família</SelectItem><SelectItem value="business">Negócio</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-2"><Label>Notas</Label><Textarea placeholder="Observações..." value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} rows={2} /></div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{initialData ? "Salvar alterações" : "Criar meta"}</Button>
    </form>
  );
}
