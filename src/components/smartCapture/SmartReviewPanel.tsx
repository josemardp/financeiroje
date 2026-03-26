import { AlertCircle, Check, FileText, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataStatusBadge } from "@/components/shared/DataStatusBadge";

type SmartReviewPanelProps = {
  sourceLabel: string;
  scopeLabel: string;
  confidenceLabel: string;
  extractedSnapshot: unknown;
  reviewedSnapshot: unknown;
  warnings?: string[];
  missingFields?: string[];
};

export function SmartReviewPanel({
  sourceLabel,
  scopeLabel,
  confidenceLabel,
  extractedSnapshot,
  reviewedSnapshot,
  warnings = [],
  missingFields = [],
}: SmartReviewPanelProps) {
  const badgeVariant =
    confidenceLabel === "alta"
      ? "default"
      : confidenceLabel === "media"
        ? "secondary"
        : "destructive";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Modo Espelho — Confirme os Dados</CardTitle>
        </div>
        <div className="flex gap-2">
          <DataStatusBadge status="suggested" />
          <Badge variant={badgeVariant}>IA: {confidenceLabel}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1">
          <FileText className="h-3 w-3" /> Origem: {sourceLabel}
        </Badge>
        <Badge variant="secondary" className="gap-1">
          <Check className="h-3 w-3" /> Estado: Confirmar manualmente
        </Badge>
        <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
          <Sparkles className="h-3 w-3" /> Escopo: {scopeLabel}
        </Badge>
      </div>

      {(warnings.length > 0 || missingFields.length > 0) && (
        <div className="space-y-3">
          {warnings.length > 0 && (
            <div className="flex items-center gap-2 text-sm rounded-lg px-4 py-3 bg-muted/30 border">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="font-semibold">Avisos da IA</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {missingFields.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 rounded-lg px-4 py-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Campos não detectados</p>
                <p className="text-xs">A IA não encontrou com clareza: {missingFields.join(", ")}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              Payload extraído
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(extractedSnapshot, null, 2)}</pre>
          </CardContent>
        </Card>

        <Card className="bg-muted/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              Payload revisado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap break-words">{JSON.stringify(reviewedSnapshot, null, 2)}</pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
