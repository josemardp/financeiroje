import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X, Save, Loader2 } from "lucide-react";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Compromisso {
  descricao: string;
  dia: number;
  valor: number;
}

interface PreferencesForm {
  tom_voz: string;
  nivel_detalhamento: string;
  frequencia_alertas: string;
  prioridade_default: string;
  tratar_parcelamentos: string;
  contexto_identidade: string;
  contexto_religioso: string;
  usar_versiculos_acf: boolean;
  valores_pessoais: string[];
  compromissos_fixos: Compromisso[];
}

const DEFAULTS: PreferencesForm = {
  tom_voz: "coach",
  nivel_detalhamento: "medio",
  frequencia_alertas: "normal",
  prioridade_default: "equilibrio",
  tratar_parcelamentos: "perguntar",
  contexto_identidade: "",
  contexto_religioso: "",
  usar_versiculos_acf: false,
  valores_pessoais: [],
  compromissos_fixos: [],
};

// ── AIPreferencesForm ──────────────────────────────────────────────────────

export default function AIPreferencesForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<PreferencesForm>(DEFAULTS);
  const [novoValor, setNovoValor] = useState("");
  const [novoCompromisso, setNovoCompromisso] = useState<Compromisso>({
    descricao: "",
    dia: 1,
    valor: 0,
  });

  // ── Query ─────────────────────────────────────────────────────────────────

  const { data: savedPrefs, isLoading } = useQuery({
    queryKey: ["ai-preferences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_ai_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!savedPrefs) return;
    setForm({
      tom_voz: savedPrefs.tom_voz ?? DEFAULTS.tom_voz,
      nivel_detalhamento: savedPrefs.nivel_detalhamento ?? DEFAULTS.nivel_detalhamento,
      frequencia_alertas: savedPrefs.frequencia_alertas ?? DEFAULTS.frequencia_alertas,
      prioridade_default: savedPrefs.prioridade_default ?? DEFAULTS.prioridade_default,
      tratar_parcelamentos: savedPrefs.tratar_parcelamentos ?? DEFAULTS.tratar_parcelamentos,
      contexto_identidade: savedPrefs.contexto_identidade ?? "",
      contexto_religioso: savedPrefs.contexto_religioso ?? "",
      usar_versiculos_acf: savedPrefs.usar_versiculos_acf ?? false,
      valores_pessoais: (savedPrefs.valores_pessoais as string[]) ?? [],
      compromissos_fixos: (savedPrefs.compromissos_fixos as Compromisso[]) ?? [],
    });
  }, [savedPrefs]);

  // ── Mutation ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_ai_preferences").upsert({
        user_id: user!.id,
        ...form,
        compromissos_fixos: form.compromissos_fixos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-preferences", user?.id] });
      toast.success("Preferências salvas");
    },
    onError: () => toast.error("Erro ao salvar preferências"),
  });

  // ── Helpers de estado ──────────────────────────────────────────────────────

  function set<K extends keyof PreferencesForm>(key: K, value: PreferencesForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addValor() {
    const v = novoValor.trim();
    if (!v || form.valores_pessoais.includes(v)) return;
    set("valores_pessoais", [...form.valores_pessoais, v]);
    setNovoValor("");
  }

  function removeValor(v: string) {
    set("valores_pessoais", form.valores_pessoais.filter((x) => x !== v));
  }

  function addCompromisso() {
    if (!novoCompromisso.descricao.trim()) return;
    set("compromissos_fixos", [...form.compromissos_fixos, { ...novoCompromisso }]);
    setNovoCompromisso({ descricao: "", dia: 1, valor: 0 });
  }

  function removeCompromisso(index: number) {
    set("compromissos_fixos", form.compromissos_fixos.filter((_, i) => i !== index));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seção 1 — Tom e estilo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Tom e estilo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs">Tom de voz</Label>
              <Select value={form.tom_voz} onValueChange={(v) => set("tom_voz", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="direto">Direto</SelectItem>
                  <SelectItem value="empatico">Empático</SelectItem>
                  <SelectItem value="analitico">Analítico</SelectItem>
                  <SelectItem value="coach">Coach</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Nível de detalhe</Label>
              <Select value={form.nivel_detalhamento} onValueChange={(v) => set("nivel_detalhamento", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="executivo">Executivo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="profundo">Profundo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Frequência de alertas</Label>
              <Select value={form.frequencia_alertas} onValueChange={(v) => set("frequencia_alertas", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minima">Mínima</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="intensa">Intensa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 2 — Aconselhamento */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Aconselhamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Prioridade padrão</Label>
              <Select value={form.prioridade_default} onValueChange={(v) => set("prioridade_default", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seguranca">Segurança</SelectItem>
                  <SelectItem value="crescimento">Crescimento</SelectItem>
                  <SelectItem value="equilibrio">Equilíbrio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tratar parcelamentos como</Label>
              <Select value={form.tratar_parcelamentos} onValueChange={(v) => set("tratar_parcelamentos", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual">Mês atual</SelectItem>
                  <SelectItem value="competencia">Competência</SelectItem>
                  <SelectItem value="perguntar">Perguntar sempre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3 — Identidade e contexto */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Identidade e contexto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* contexto_identidade */}
          <div className="space-y-2">
            <Label className="text-xs">Contexto de identidade</Label>
            <Textarea
              value={form.contexto_identidade}
              onChange={(e) => set("contexto_identidade", e.target.value)}
              placeholder="Ex: Cap PMESP, casado com Esdra, filha Melinda, CCB"
              className="text-sm min-h-16 resize-y"
            />
          </div>

          {/* valores_pessoais */}
          <div className="space-y-2">
            <Label className="text-xs">Valores pessoais</Label>
            <div className="flex flex-wrap gap-1.5 min-h-8">
              {form.valores_pessoais.map((v) => (
                <Badge key={v} variant="secondary" className="gap-1 pr-1">
                  {v}
                  <button
                    type="button"
                    onClick={() => removeValor(v)}
                    className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                    aria-label={`Remover ${v}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addValor())}
                placeholder="Adicionar valor..."
                className="text-sm h-8"
              />
              <Button
                type="button" variant="outline" size="sm" className="h-8 px-3 shrink-0"
                onClick={addValor}
                disabled={!novoValor.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* compromissos_fixos */}
          <div className="space-y-2">
            <Label className="text-xs">Compromissos fixos</Label>
            {form.compromissos_fixos.length > 0 && (
              <div className="space-y-1.5">
                {form.compromissos_fixos.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm">
                    <span className="flex-1 truncate">{c.descricao}</span>
                    <span className="text-muted-foreground shrink-0">dia {c.dia}</span>
                    <span className="text-muted-foreground shrink-0">
                      R$ {c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCompromisso(i)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      aria-label="Remover compromisso"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
              <Input
                value={novoCompromisso.descricao}
                onChange={(e) => setNovoCompromisso((c) => ({ ...c, descricao: e.target.value }))}
                placeholder="Descrição"
                className="text-sm h-8"
              />
              <Input
                type="number" min={1} max={31}
                value={novoCompromisso.dia}
                onChange={(e) => setNovoCompromisso((c) => ({ ...c, dia: Number(e.target.value) }))}
                className="text-sm h-8 w-16 text-center"
                title="Dia do mês"
              />
              <Input
                type="number" min={0} step={0.01}
                value={novoCompromisso.valor}
                onChange={(e) => setNovoCompromisso((c) => ({ ...c, valor: Number(e.target.value) }))}
                className="text-sm h-8 w-24"
                placeholder="R$"
              />
              <Button
                type="button" variant="outline" size="sm" className="h-8 px-3 shrink-0"
                onClick={addCompromisso}
                disabled={!novoCompromisso.descricao.trim()}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção 4 — Preferências religiosas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Preferências religiosas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3">
            <Label className="leading-snug text-sm">Usar versículos da Bíblia ACF nas respostas</Label>
            <Switch
              checked={form.usar_versiculos_acf}
              onCheckedChange={(v) => set("usar_versiculos_acf", v)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Contexto religioso</Label>
            <Textarea
              value={form.contexto_religioso}
              onChange={(e) => set("contexto_religioso", e.target.value)}
              placeholder="Ex: Membro da CCB, dízimo todo dia 5"
              className="text-sm min-h-16 resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Salvar */}
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
      >
        {saveMutation.isPending
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <Save className="mr-2 h-4 w-4" />}
        Salvar preferências
      </Button>
    </div>
  );
}
