import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Settings, Shield, Bell, User, Loader2 } from "lucide-react";

interface FinancialPreferences {
  reserva_emergencia_valor?: number;
  reserva_emergencia_meses_meta?: number;
  reserva_emergencia_conta_id?: string;
  renda_principal?: number;
  escopo_padrao?: string;
  dia_fechamento?: number;
  alertas_reserva?: boolean;
  alertas_orcamento?: boolean;
  alertas_vencimento?: boolean;
  alertas_metas?: boolean;
}

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState("");
  const [prefs, setPrefs] = useState<FinancialPreferences>({
    reserva_emergencia_valor: 0,
    reserva_emergencia_meses_meta: 6,
    renda_principal: 0,
    escopo_padrao: "private",
    dia_fechamento: 1,
    alertas_reserva: true,
    alertas_orcamento: true,
    alertas_vencimento: true,
    alertas_metas: true,
  });

  useEffect(() => {
    if (profile) {
      setNome(profile.nome || "");
      const existing = (profile.preferences || {}) as FinancialPreferences;
      setPrefs(p => ({ ...p, ...existing }));
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome, preferences: prefs as any })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Erro ao salvar configurações");
    } else {
      toast.success("Configurações salvas!");
      await refreshProfile();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Configurações" description="Perfil, preferências financeiras e alertas" />

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" /> Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email || ""} disabled className="opacity-60" />
          </div>
        </CardContent>
      </Card>

      {/* Emergency Reserve */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Reserva de Emergência</CardTitle>
          <CardDescription>Configure sua reserva para que o sistema avalie corretamente sua saúde financeira</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor atual da reserva (R$)</Label>
              <Input type="number" step="0.01" min="0" value={prefs.reserva_emergencia_valor || ""}
                onChange={e => setPrefs(p => ({ ...p, reserva_emergencia_valor: Number(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Meta de cobertura (meses)</Label>
              <Input type="number" min="1" max="24" value={prefs.reserva_emergencia_meses_meta || ""}
                onChange={e => setPrefs(p => ({ ...p, reserva_emergencia_meses_meta: Number(e.target.value) || 6 }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Renda mensal principal (R$)</Label>
            <Input type="number" step="0.01" min="0" value={prefs.renda_principal || ""}
              onChange={e => setPrefs(p => ({ ...p, renda_principal: Number(e.target.value) || 0 }))}
              placeholder="Usada para cálculo de cobertura" />
          </div>
        </CardContent>
      </Card>

      {/* Financial Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Settings className="h-4 w-4" /> Preferências Financeiras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Escopo padrão</Label>
              <Select value={prefs.escopo_padrao || "private"} onValueChange={v => setPrefs(p => ({ ...p, escopo_padrao: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Pessoal</SelectItem>
                  <SelectItem value="family">Família</SelectItem>
                  <SelectItem value="business">Negócio/MEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dia de fechamento</Label>
              <Input type="number" min="1" max="31" value={prefs.dia_fechamento || 1}
                onChange={e => setPrefs(p => ({ ...p, dia_fechamento: Number(e.target.value) || 1 }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alert Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Preferências de Alertas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "alertas_reserva", label: "Alertas de reserva de emergência" },
            { key: "alertas_orcamento", label: "Alertas de orçamento estourado" },
            { key: "alertas_vencimento", label: "Alertas de vencimento de parcelas" },
            { key: "alertas_metas", label: "Alertas de metas em risco" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label>{label}</Label>
              <Switch checked={prefs[key as keyof FinancialPreferences] as boolean ?? true}
                onCheckedChange={v => setPrefs(p => ({ ...p, [key]: v }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Salvar configurações
      </Button>
    </div>
  );
}
