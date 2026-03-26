import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount, deleteMyData, downloadJsonFile, exportMyData } from "@/lib/privacy";
import { matchesConfirmationPhrase } from "@/lib/authSecurity";
import { useTheme } from "@/components/theme/ThemeProvider";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Settings,
  Shield,
  Bell,
  User,
  Loader2,
  Palette,
  Moon,
  Sun,
  Monitor,
  Download,
  Trash2,
  UserX,
  ShieldAlert,
} from "lucide-react";

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

interface PrivacyFormState {
  currentPassword: string;
  reason: string;
  confirmationPhrase: string;
}

interface PrivacyActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  requiredPhrase: string;
  actionLabel: string;
  actionVariant?: "default" | "destructive";
  loading: boolean;
  form: PrivacyFormState;
  setForm: Dispatch<SetStateAction<PrivacyFormState>>;
  onConfirm: () => void;
}

const DELETE_DATA_PHRASE = "EXCLUIR MEUS DADOS";
const DELETE_ACCOUNT_PHRASE = "EXCLUIR MINHA CONTA";
const EMPTY_PRIVACY_FORM: PrivacyFormState = {
  currentPassword: "",
  reason: "",
  confirmationPhrase: "",
};

function PrivacyActionDialog({
  open,
  onOpenChange,
  title,
  description,
  requiredPhrase,
  actionLabel,
  actionVariant = "destructive",
  loading,
  form,
  setForm,
  onConfirm,
}: PrivacyActionDialogProps) {
  const closeDialog = (nextOpen: boolean) => {
    if (loading) return;
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setForm(EMPTY_PRIVACY_FORM);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={closeDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
            Para confirmar, digite exatamente: <strong className="text-foreground">{requiredPhrase}</strong>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${requiredPhrase}-password`}>Senha atual</Label>
            <Input
              id={`${requiredPhrase}-password`}
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
              placeholder="Digite sua senha atual"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${requiredPhrase}-reason`}>Motivo (opcional)</Label>
            <Textarea
              id={`${requiredPhrase}-reason`}
              value={form.reason}
              onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Explique o motivo, se desejar"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${requiredPhrase}-confirmation`}>Confirmação obrigatória</Label>
            <Input
              id={`${requiredPhrase}-confirmation`}
              value={form.confirmationPhrase}
              onChange={(e) => setForm((prev) => ({ ...prev, confirmationPhrase: e.target.value }))}
              placeholder={requiredPhrase}
              disabled={loading}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={() => closeDialog(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" variant={actionVariant} onClick={onConfirm} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [deleteDataLoading, setDeleteDataLoading] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteDataOpen, setDeleteDataOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteDataForm, setDeleteDataForm] = useState<PrivacyFormState>(EMPTY_PRIVACY_FORM);
  const [deleteAccountForm, setDeleteAccountForm] = useState<PrivacyFormState>(EMPTY_PRIVACY_FORM);
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
      setPrefs((p) => ({ ...p, ...existing }));
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

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const response = await exportMyData();
      const payload = (response.payload ?? {}) as Record<string, unknown>;
      const timestamp =
        typeof payload.exportedAt === "string"
          ? payload.exportedAt.replace(/[:.]/g, "-")
          : new Date().toISOString().replace(/[:.]/g, "-");

      downloadJsonFile(`financeai-export-${timestamp}.json`, payload);
      toast.success(response.message || "Exportação concluída.");
    } catch (error) {
      toast.error("Falha ao exportar dados", {
        description: error instanceof Error ? error.message : "Erro inesperado ao exportar dados.",
      });
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteData = async () => {
    if (!deleteDataForm.currentPassword.trim()) {
      toast.error("Informe sua senha atual.");
      return;
    }

    if (!matchesConfirmationPhrase(deleteDataForm.confirmationPhrase, DELETE_DATA_PHRASE)) {
      toast.error(`Digite exatamente: ${DELETE_DATA_PHRASE}`);
      return;
    }

    setDeleteDataLoading(true);

    try {
      const response = await deleteMyData({
        currentPassword: deleteDataForm.currentPassword,
        reason: deleteDataForm.reason.trim() || undefined,
        confirmationPhrase: deleteDataForm.confirmationPhrase,
      });

      toast.success(response.message || "Dados excluídos com sucesso.");
      setDeleteDataOpen(false);
      setDeleteDataForm(EMPTY_PRIVACY_FORM);
      await refreshProfile();
    } catch (error) {
      toast.error("Falha ao excluir dados", {
        description: error instanceof Error ? error.message : "Erro inesperado ao excluir dados.",
      });
    } finally {
      setDeleteDataLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccountForm.currentPassword.trim()) {
      toast.error("Informe sua senha atual.");
      return;
    }

    if (!matchesConfirmationPhrase(deleteAccountForm.confirmationPhrase, DELETE_ACCOUNT_PHRASE)) {
      toast.error(`Digite exatamente: ${DELETE_ACCOUNT_PHRASE}`);
      return;
    }

    setDeleteAccountLoading(true);

    try {
      const response = await deleteMyAccount({
        currentPassword: deleteAccountForm.currentPassword,
        reason: deleteAccountForm.reason.trim() || undefined,
        confirmationPhrase: deleteAccountForm.confirmationPhrase,
      });

      toast.success(response.message || "Conta excluída com sucesso.");
      await signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      toast.error("Falha ao excluir conta", {
        description: error instanceof Error ? error.message : "Erro inesperado ao excluir conta.",
      });
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const themeOptions = [
    { value: "light", label: "Claro", icon: Sun },
    { value: "dark", label: "Escuro", icon: Moon },
    { value: "system", label: "Sistema", icon: Monitor },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <PageHeader title="Configurações" description="Perfil, aparência, preferências financeiras, alertas e privacidade" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="h-4 w-4" />
            Aparência
          </CardTitle>
          <CardDescription>Escolha como o FinanceAI aparece para você</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                  theme === value
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Icon className={`h-5 w-5 ${theme === value ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${theme === value ? "text-primary" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email || ""} disabled className="opacity-60" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Reserva de Emergência
          </CardTitle>
          <CardDescription>Configure sua reserva para avaliação da saúde financeira</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor atual da reserva (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={prefs.reserva_emergencia_valor || ""}
                onChange={(e) => setPrefs((p) => ({ ...p, reserva_emergencia_valor: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Meta de cobertura (meses)</Label>
              <Input
                type="number"
                min="1"
                max="24"
                value={prefs.reserva_emergencia_meses_meta || ""}
                onChange={(e) => setPrefs((p) => ({ ...p, reserva_emergencia_meses_meta: Number(e.target.value) || 6 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Renda mensal principal (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={prefs.renda_principal || ""}
              onChange={(e) => setPrefs((p) => ({ ...p, renda_principal: Number(e.target.value) || 0 }))}
              placeholder="Usada para cálculo de cobertura"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Preferências Financeiras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Escopo padrão</Label>
              <Select value={prefs.escopo_padrao || "private"} onValueChange={(v) => setPrefs((p) => ({ ...p, escopo_padrao: v }))}>
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
              <Input
                type="number"
                min="1"
                max="31"
                value={prefs.dia_fechamento || 1}
                onChange={(e) => setPrefs((p) => ({ ...p, dia_fechamento: Number(e.target.value) || 1 }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" />
            Preferências de Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "alertas_reserva", label: "Alertas de reserva de emergência" },
            { key: "alertas_orcamento", label: "Alertas de orçamento estourado" },
            { key: "alertas_vencimento", label: "Alertas de vencimento de parcelas" },
            { key: "alertas_metas", label: "Alertas de metas em risco" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="font-normal">{label}</Label>
              <Switch
                checked={(prefs[key as keyof FinancialPreferences] as boolean) ?? true}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4" />
            Privacidade e LGPD
          </CardTitle>
          <CardDescription>
            Exporte seus dados, exclua conteúdo operacional ou encerre sua conta com confirmação forte.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
            Antes de ações destrutivas, revise a{" "}
            <Link to="/privacidade" className="font-medium text-primary underline underline-offset-4">
              Política de Privacidade
            </Link>
            .
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Download className="h-4 w-4" />
                  Exportar meus dados
                </CardTitle>
                <CardDescription>Baixa um arquivo JSON com os dados do usuário autenticado.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={handleExportData} disabled={exportingData}>
                  {exportingData ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Exportar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Trash2 className="h-4 w-4" />
                  Excluir meus dados
                </CardTitle>
                <CardDescription>Remove dados operacionais e mantém a conta ativa.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => setDeleteDataOpen(true)}>
                  Excluir dados
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <UserX className="h-4 w-4 text-destructive" />
                  Excluir minha conta
                </CardTitle>
                <CardDescription>Remove a conta autenticada e seus dados relacionados.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="w-full" onClick={() => setDeleteAccountOpen(true)}>
                  Excluir conta
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full h-12 text-base">
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Salvar configurações
      </Button>

      <PrivacyActionDialog
        open={deleteDataOpen}
        onOpenChange={setDeleteDataOpen}
        title="Excluir meus dados"
        description="Esta ação remove dados operacionais do usuário autenticado, mas mantém a conta ativa."
        requiredPhrase={DELETE_DATA_PHRASE}
        actionLabel="Confirmar exclusão de dados"
        loading={deleteDataLoading}
        form={deleteDataForm}
        setForm={setDeleteDataForm}
        onConfirm={handleDeleteData}
      />

      <PrivacyActionDialog
        open={deleteAccountOpen}
        onOpenChange={setDeleteAccountOpen}
        title="Excluir minha conta"
        description="Esta ação é destrutiva e remove a conta autenticada. Use apenas se tiver certeza."
        requiredPhrase={DELETE_ACCOUNT_PHRASE}
        actionLabel="Confirmar exclusão da conta"
        loading={deleteAccountLoading}
        form={deleteAccountForm}
        setForm={setDeleteAccountForm}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
