/**
 * FinanceAI — Quality Center
 * 
 * Painel centralizado que exibe:
 * - Problemas de qualidade de dados
 * - Duplicatas suspeitas
 * - Transações sem categoria
 * - Dados inconsistentes
 * - Recomendações antes do fechamento
 */

import { AlertTriangle, CheckCircle, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DataQualityIssue, DataQualityReport } from "@/services/dataQuality";

interface QualityCenterProps {
  report: DataQualityReport;
  onActionClick?: (actionRoute: string) => void;
}

export function QualityCenter({ report, onActionClick }: QualityCenterProps) {
  const getHealthIcon = (health: string) => {
    switch (health) {
      case "good":
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case "needs_attention":
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      case "critical":
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      default:
        return null;
    }
  };

  const getHealthLabel = (health: string) => {
    switch (health) {
      case "good":
        return "Dados em bom estado";
      case "needs_attention":
        return "Requer atenção";
      case "critical":
        return "Crítico";
      default:
        return "Desconhecido";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "info":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertTriangle className="w-4 h-4" />;
      case "warning":
        return <AlertCircle className="w-4 h-4" />;
      case "info":
        return <TrendingUp className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Health Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Qualidade de Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getHealthIcon(report.overallHealth)}
              <div>
                <p className="font-medium">{getHealthLabel(report.overallHealth)}</p>
                <p className="text-sm text-gray-600">
                  {report.criticalCount > 0 && `${report.criticalCount} crítico(s) • `}
                  {report.warningCount > 0 && `${report.warningCount} aviso(s) • `}
                  {report.infoCount > 0 && `${report.infoCount} info(s)`}
                </p>
              </div>
            </div>
            <Badge
              variant={
                report.overallHealth === "good"
                  ? "default"
                  : report.overallHealth === "needs_attention"
                    ? "secondary"
                    : "destructive"
              }
            >
              {report.criticalCount + report.warningCount + report.infoCount} problema(s)
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Issues List */}
      {report.issues.length > 0 ? (
        <div className="space-y-3">
          {report.issues.map((issue) => (
            <Card key={issue.id} className={`border-l-4 ${getSeverityColor(issue.severity)}`}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1">
                      <p className="font-medium text-sm">{issue.title}</p>
                      <p className="text-xs text-gray-600 mt-1">{issue.description}</p>
                      {issue.entity && (
                        <p className="text-xs text-gray-500 mt-2">
                          Entidade: <span className="font-mono">{issue.entity}</span>
                          {issue.entityId && ` (${issue.entityId})`}
                        </p>
                      )}
                    </div>
                  </div>
                  {issue.actionLabel && issue.actionRoute && (
                    <button
                      onClick={() => onActionClick?.(issue.actionRoute!)}
                      className="px-3 py-1 text-xs font-medium bg-white border rounded hover:bg-gray-50 whitespace-nowrap"
                    >
                      {issue.actionLabel}
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800">
                Nenhum problema de qualidade detectado. Dados prontos para fechamento.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {report.issues.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recomendações</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              {report.criticalCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-red-500 font-bold">•</span>
                  <span>Resolva todos os problemas críticos antes de fechar o período.</span>
                </li>
              )}
              {report.warningCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-yellow-500 font-bold">•</span>
                  <span>Revise os avisos — eles podem afetar a precisão das análises.</span>
                </li>
              )}
              {report.infoCount > 0 && (
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 font-bold">•</span>
                  <span>Considere resolver as informações para melhorar a qualidade geral.</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
