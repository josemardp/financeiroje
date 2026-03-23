/**
 * FinanceAI — Valores Familiares (CRUD funcional)
 */
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScopeBadge } from "@/components/shared/ScopeBadge";
import { toast } from "sonner";
import { Heart, Plus, Trash2, Pencil, Loader2 } from "lucide-react";

export default function FamilyValues() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("nome");
      return data || [];
    },
  });

  const { data: values, isLoading } = useQuery({
    queryKey: ["family-values"],
    queryFn: async () => {
      const { data } = await supabase
        .from("family_values")
        .select("*, categories(nome, icone)")
        .order("importancia", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("family_values").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family-values"] });
      toast.success("Valor removido");
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Valores Familiares" description="O que nunca deve ser cortado — a IA respeita esses princípios">
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) setEditItem(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Novo valor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editItem ? "Editar Valor" : "Novo Valor Familiar"}</DialogTitle></DialogHeader>
            <ValueForm
              categories={categories || []}
              editData={editItem}
              onSuccess={() => {
                setIsOpen(false);
                setEditItem(null);
                queryClient.invalidateQueries({ queryKey: ["family-values"] });
              }}
            />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
        <Heart className="h-3 w-3 text-destructive" />
        <span>Valores familiares são usados pela IA Conselheira para personalizar sugestões e gerar alertas de incoerência.</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !values || values.length === 0 ? (
        <EmptyState icon={Heart} title="Nenhum valor cadastrado" description="Registre o que importa: pizza às sextas, lazer com a família, educação dos filhos.">
          <Button onClick={() => setIsOpen(true)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {values.map((v: any) => (
            <Card key={v.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xl shrink-0">{v.categories?.icone || "❤️"}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{v.descricao}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">Importância: {v.importancia}/10</span>
                      <ScopeBadge scope={v.scope} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Importance bar */}
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mr-2">
                    <div className="h-full bg-destructive rounded-full" style={{ width: `${(v.importancia || 5) * 10}%` }} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8"
                    onClick={() => { setEditItem(v); setIsOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(v.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ValueForm({ categories, editData, onSuccess }: { categories: any[]; editData?: any; onSuccess: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    descricao: editData?.descricao || "",
    importancia: editData?.importancia || 5,
    categoria_id: editData?.categoria_id || "",
    scope: editData?.scope || "family",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.descricao.trim()) {
      toast.error("Preencha a descrição");
      return;
    }
    setIsSubmitting(true);
    const payload = {
      user_id: user.id,
      descricao: form.descricao.trim(),
      importancia: form.importancia,
      categoria_id: form.categoria_id || null,
      scope: form.scope as any,
    };

    const { error } = editData
      ? await supabase.from("family_values").update(payload).eq("id", editData.id)
      : await supabase.from("family_values").insert(payload);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success(editData ? "Valor atualizado!" : "Valor criado!");
      onSuccess();
    }
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Descrição *</Label>
        <Input placeholder='Ex: "Pizza às sextas com a família" ou "Educação da Melinda"'
          value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} required />
      </div>
      <div className="space-y-2">
        <Label>Importância ({form.importancia}/10)</Label>
        <Slider value={[form.importancia]} onValueChange={([v]) => setForm(f => ({ ...f, importancia: v }))}
          min={1} max={10} step={1} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Categoria relacionada</Label>
          <Select value={form.categoria_id} onValueChange={v => setForm(f => ({ ...f, categoria_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
            <SelectContent>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.icone} {c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Escopo</Label>
          <Select value={form.scope} onValueChange={v => setForm(f => ({ ...f, scope: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="family">Família</SelectItem>
              <SelectItem value="private">Pessoal</SelectItem>
              <SelectItem value="business">Negócio</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {editData ? "Atualizar" : "Salvar valor"}
      </Button>
    </form>
  );
}
