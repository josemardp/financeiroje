import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SystemHealthRow = {
  component_name: string;
  component_type: string;
  last_status: string | null;
  last_execution_at: string | null;
  last_duration_ms: number | null;
  error_count_24h: number;
  max_silent_hours: number;
  max_error_count: number;
  max_duration_ms: number;
  is_recurring_error: boolean;
  is_high_latency: boolean;
  is_operational_silence: boolean;
  alert_status: 'alert' | 'warning' | 'healthy';
};

function describeSupabaseError(error: unknown) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const payload = error as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      payload.message,
      payload.details ? `Detalhes: ${payload.details}` : null,
      payload.hint ? `Hint: ${payload.hint}` : null,
      payload.code ? `Código: ${payload.code}` : null,
    ].filter(Boolean);

    if (parts.length > 0) return parts.join(" | ");
    return JSON.stringify(error);
  }

  return "Erro desconhecido ao consultar a view de observabilidade.";
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function formatDuration(value: number | null) {
  if (value === null || value === undefined) return "-";
  return `${value} ms`;
}

function statusVariant(status: string | null, alertStatus: string) {
  if (alertStatus === "alert") return "destructive";
  if (alertStatus === "warning") return "outline"; // Warning is usually the last_status = 'error' without threshold breach
  if (status === "success") return "secondary";
  return "outline";
}

export default function SystemHealthOverview() {
  const {
    data: components = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["system-health-alerts"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as typeof supabase)
        .from("system_health_alerts" as never)
        .select("*")
        .order("component_name", { ascending: true });

      if (error) {
        console.error("Erro ao consultar system_health_alerts:", error);
        throw new Error(describeSupabaseError(error));
      }

      return (data ?? []).map((row) => ({
        ...row,
        error_count_24h: row.error_count_24h ?? 0,
      })) as SystemHealthRow[];
    },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Saúde do Sistema"
        description="Monitoramento de saúde baseado em thresholds de execução e erros"
      >
        <Badge variant="outline" className="gap-1">
          <Activity className="h-3 w-3" />
          Observabilidade
        </Badge>
      </PageHeader>

      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-start gap-3 py-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1">
              <h3 className="font-medium">Não foi possível carregar a saúde do sistema</h3>
              <p className="text-sm text-muted-foreground">
                {describeSupabaseError(error)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : components.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="mb-4 h-12 w-12 text-muted-foreground/20" />
            <h3 className="text-lg font-medium">Nenhum componente registrado</h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              A view ainda não retornou registros de telemetria ou thresholds configurados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Componentes monitorados</CardTitle>
            <CardDescription>Alertas baseados em thresholds de system_health_thresholds</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Componente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Alertas Ativos</TableHead>
                  <TableHead>Última execução</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead className="pr-6 text-right">Erros 24h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((component) => (
                  <TableRow key={component.component_name}>
                    <TableCell className="pl-6 font-medium">
                      <div className="flex flex-col">
                        <span>{component.component_name}</span>
                        <span className="text-xs text-muted-foreground font-normal">{component.component_type}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(component.last_status, component.alert_status)}>
                        {component.alert_status === "alert" ? "ALERT" : (component.last_status || "-")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {component.is_operational_silence && (
                          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">SILÊNCIO</Badge>
                        )}
                        {component.is_recurring_error && (
                          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">ERRO RECORRENTE</Badge>
                        )}
                        {component.is_high_latency && (
                          <Badge variant="destructive" className="text-[10px] h-5 px-1.5">LATÊNCIA ALTA</Badge>
                        )}
                        {!component.is_operational_silence && !component.is_recurring_error && !component.is_high_latency && (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(component.last_execution_at)}</TableCell>
                    <TableCell>
                      <span className={component.is_high_latency ? "text-destructive font-medium" : ""}>
                        {formatDuration(component.last_duration_ms)}
                      </span>
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <span className={component.is_recurring_error ? "text-destructive font-bold" : ""}>
                        {component.error_count_24h}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
