
/**
 * FinanceAI — Módulo Fiscal / IRPF
 * 
 * Visão consolidada para declaração anual:
 * 1. Rendimentos e Deduções
 * 2. Comparativo Simplificada vs Completa
 * 3. Gestão de Documentos Fiscais
 * 4. Alertas de Pendências
 */

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingState } from "@/components/shared/LoadingState";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency, formatPercent } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { backendEngine } from "@/services/financeEngine/backend";
import { filterOfficialTransactions } from "@/services/financeEngine/types";
import { 
  FileText, 
  Calculator, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Heart, 
  GraduationCap, 
  Users, 
  ShieldCheck,
  Download,
  Info,
} from "lucide-react";

export default function Fiscal() {
  const currentYear = new Date().getFullYear();
  const fiscalYear = currentYear - 1;

  const { data: transactions = [], isLoading: loadingTxns } = useQuery({
    queryKey: ["fiscal-transactions", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, valor, tipo, data, scope, data_status, e_mei, categoria_id")
        .gte("data", `${fiscalYear}-01-01`)
        .lte("data", `${fiscalYear}-12-31`)
        .in("scope", ["private", "family"]);

      if (error) throw error;
      return data || [];
    }
  });

  const { data: documents = [], isLoading: loadingDocs } = useQuery({
    queryKey: ["fiscal-documents", fiscalYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("ano_fiscal", fiscalYear);

      if (error) throw error;
      return data || [];
    }
  });

  const { data: fiscalData, isLoading: loadingFiscal } = useQuery({
    queryKey: ["fiscal-summary", fiscalYear, transactions.length],
    queryFn: async () => {
      const officialTxns = filterOfficialTransactions(transactions as any);
      return backendEngine.calculateFiscalSummary(officialTxns as any, fiscalYear);
    },
    enabled: transactions.length >= 0
  });

  if (loadingTxns || loadingDocs || loadingFiscal) {
    return <LoadingState message="Calculando dados fiscais..." fullPage />;
  }

  const missingDocs = (fiscalData?.deductibleExpenseCount || 0) > documents.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader 
        title="Módulo Fiscal / IRPF" 
        description={`Visão consolidada para o ano-calendário ${fiscalYear}`}
      >
        <div className="flex gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1 px-3">
            <Calendar className="h-3.5 w-3.5" />
            Exercício {fiscalYear + 1}
          </Badge>
          <Badge variant="outline" className="gap-1.5 py-1 px-3">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Auditado
          </Badge>
        </div>
      </PageHeader>

      {missingDocs && (
        <Alert variant="default" className="border-warning/30 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle>Pendência de Documentação</AlertTitle>
          <AlertDescription>
            Você possui {fiscalData?.deductibleExpenseCount} despesas dedutíveis marcadas, mas apenas {documents.length} comprovantes anexados.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Comparativo de Tributação
                </CardTitle>
                <CardDescription>Análise entre Declaração Simplificada e Completa</CardDescription>
              </div>
              <Badge variant={fiscalData?.melhorOpcao === 'simplificada' ? 'secondary' : 'default'}>
                Recomendado: {fiscalData?.melhorOpcao === 'simplificada' ? 'Simplificada' : 'Completa'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-4 rounded-xl border-2 transition-colors ${fiscalData?.melhorOpcao === 'simplificada' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <h4 className="font-bold mb-4 flex justify-between items-center">
                  Simplificada
                  {fiscalData?.melhorOpcao === 'simplificada' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rendimentos Tributáveis</span>
                    <span>{formatCurrency(fiscalData?.totalIncome || 0)}</span>
                  </div>
                  <div className="flex justify-between text-success">
                    <span>Desconto Padrão (20%)</span>
                    <span>- {formatCurrency(fiscalData?.standardDiscount || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Base de Cálculo</span>
                    <span>{formatCurrency(fiscalData?.baseSimplificada || 0)}</span>
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border-2 transition-colors ${fiscalData?.melhorOpcao === 'completa' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <h4 className="font-bold mb-4 flex justify-between items-center">
                  Completa (Deduções Legais)
                  {fiscalData?.melhorOpcao === 'completa' && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rendimentos Tributáveis</span>
                    <span>{formatCurrency(fiscalData?.totalIncome || 0)}</span>
                  </div>
                  <div className="flex justify-between text-success">
                    <span>Total de Deduções</span>
                    <span>- {formatCurrency(fiscalData?.totalDeductions || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Base de Cálculo</span>
                    <span>{formatCurrency(fiscalData?.baseCompleta || 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg flex gap-3 items-start">
              <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Esta é uma estimativa baseada nas transações confirmadas no sistema. 
                O valor real do imposto depende de fatores adicionais. Consulte sempre um contador.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive" />
              Deduções por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { icon: Heart, color: "text-info bg-info/10", label: "Saúde", sub: "Sem limite de teto", key: "saude" },
                { icon: GraduationCap, color: "text-primary bg-primary/10", label: "Educação", sub: "Limite individual anual", key: "educacao" },
                { icon: ShieldCheck, color: "text-warning bg-warning/10", label: "Previdência", sub: "PGBL até 12% da renda", key: "previdencia" },
                { icon: Users, color: "text-muted-foreground bg-muted", label: "Dependentes", sub: "Valor fixo por CPF", key: "dependentes" },
              ].map(({ icon: Icon, color, label, sub, key }) => (
                <div key={key} className="flex items-center justify-between p-2.5 hover:bg-muted/50 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                  </div>
                  <span className="font-bold font-mono">{formatCurrency(fiscalData?.deductionsByCategory?.[key] || 0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Documentos e Comprovantes Fiscais
            </CardTitle>
            <CardDescription>Documentos anexados para o ano de {fiscalYear}</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Kit IRPF
          </Button>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium">Nenhum documento encontrado</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                Anexe recibos e notas na Captura Inteligente para vê-los aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 border rounded-xl flex items-start gap-4 hover:border-primary/50 transition-colors">
                  <div className="p-3 bg-primary/5 rounded-lg text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 uppercase">{doc.document_type || 'Outro'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{doc.ano_fiscal}</Badge>
                      {(doc.document_type === 'recibo_medico' || doc.document_type === 'recibo_educacao') && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-success/10 text-success">
                          Dedutível
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
