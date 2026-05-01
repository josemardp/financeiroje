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
  last_status: string | null;
  last_execution_at: string | null;
  last_duration_ms: number | null;
  error_count_24h: number;
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

function statusVariant(status: string | null) {
  if (status === "error") return "destructive";
  if (status === "success") return "secondary";
  return "outline";
}

export default function SystemHealthOverview() {
  const {
    data: components = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["system-health-overview"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("system_health_overview")
        .select("component_name,last_status,last_execution_at,last_duration_ms,error_count_24h")
        .order("component_name", { ascending: true });

      if (error) {
        console.error("Erro ao consultar system_health_overview:", error);
        throw new Error(describeSupabaseError(error));
      }

      return (data || []) as SystemHealthRow[];
    },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Saúde do Sistema"
        description="Últimas execuções e erros registrados pela telemetria"
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
              A view ainda não retornou registros de telemetria para exibição.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Componentes monitorados</CardTitle>
            <CardDescription>Dados consolidados por component_name em system_health_overview</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Componente</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última execução</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead className="pr-6 text-right">Erros 24h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((component) => (
                  <TableRow key={component.component_name}>
                    <TableCell className="pl-6 font-medium">{component.component_name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(component.last_status)}>
                        {component.last_status || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(component.last_execution_at)}</TableCell>
                    <TableCell>{formatDuration(component.last_duration_ms)}</TableCell>
                    <TableCell className="pr-6 text-right">
                      {component.error_count_24h > 0 ? (
                        <Badge variant="destructive">{component.error_count_24h}</Badge>
                      ) : (
                        <span>{component.error_count_24h}</span>
                      )}
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
