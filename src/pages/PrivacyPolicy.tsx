import { Link } from "react-router-dom";
import { ShieldCheck, Download, Trash2, ArrowLeft, LockKeyhole } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Privacidade e LGPD
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Política de Privacidade do FinanceAI</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Este documento resume como o FinanceAI trata dados pessoais, dados financeiros e solicitações de exportação ou exclusão.
            </p>
          </div>

          <Button asChild variant="outline">
            <Link to="/auth">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Dados tratados pelo produto</CardTitle>
            <CardDescription>Com base no código atual do FinanceAI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              O sistema pode armazenar dados de perfil, contas, transações, orçamentos, dívidas, metas, assinaturas, alertas, documentos,
              conversas com IA, relatórios de qualidade, fechamentos e registros de auditoria.
            </p>
            <p>
              O tratamento respeita escopos de uso como <strong className="text-foreground">private</strong>, <strong className="text-foreground">family</strong> e <strong className="text-foreground">business</strong>,
              além de estados de qualidade do dado como <strong className="text-foreground">confirmed</strong>, <strong className="text-foreground">suggested</strong> e outros.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LockKeyhole className="h-5 w-5 text-primary" />
                2. Segurança e isolamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>O app utiliza autenticação via Supabase e políticas de acesso por usuário no banco de dados.</p>
              <p>Documentos ficam em bucket privado e o acesso é restrito ao diretório do próprio usuário.</p>
              <p>Operações críticas devem exigir autenticação válida e confirmação explícita do usuário.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                3. Exportação de dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
              <p>O usuário pode solicitar exportação estruturada dos próprios dados para conferência, portabilidade e guarda pessoal.</p>
              <p>A exportação deve priorizar dados efetivamente pertencentes ao usuário autenticado, sem expor dados de terceiros por engano.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              4. Exclusão de dados e exclusão de conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              O FinanceAI diferencia <strong className="text-foreground">exclusão de dados</strong> de <strong className="text-foreground">exclusão de conta</strong>.
            </p>
            <p>
              A exclusão de dados remove o conteúdo operacional do usuário, mantendo a conta ativa. A exclusão de conta remove a conta autenticada e seus dados relacionados.
            </p>
            <p>
              Para reduzir risco de exclusão indevida, o fluxo exige senha atual, confirmação explícita e mensagem forte de alerta.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Direitos do titular</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>O titular pode solicitar acesso, exportação, correção e exclusão, conforme aplicável.</p>
            <p>Solicitações críticas devem gerar trilha mínima de auditoria para fins operacionais e de segurança.</p>
            <p>Em caso de dúvida sobre o tratamento, o canal oficial deve orientar a conferência antes de qualquer ação destrutiva.</p>
          </CardContent>
        </Card>

        <div className="rounded-2xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground leading-relaxed">
          Esta política resume o comportamento esperado da Fase 1 da plataforma e deve ser mantida alinhada ao código efetivamente implantado.
        </div>
      </div>
    </div>
  );
}
