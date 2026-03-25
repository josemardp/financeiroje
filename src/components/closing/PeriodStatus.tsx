/**
 * FinanceAI — Period Status Component
 * 
 * Exibe o estado do período:
 * - Aberto (edições permitidas)
 * - Em revisão (edições com cuidado)
 * - Fechado (edições bloqueadas)
 */

import { Lock, Unlock, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PeriodLockInfo } from "@/services/financeEngine/closingEngine";
import { formatDate } from "@/lib/format";

interface PeriodStatusProps {
  lockInfo: PeriodLockInfo;
  onReopenClick?: () => void;
  canReopen?: boolean;
}

export function PeriodStatus({ lockInfo, onReopenClick, canReopen }: PeriodStatusProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <Unlock className="w-5 h-5 text-green-500" />;
      case "reviewing":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case "closed":
        return <Lock className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "open":
        return "Período Aberto";
      case "reviewing":
        return "Em Revisão";
      case "closed":
        return "Período Fechado";
      default:
        return "Desconhecido";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-green-50 border-green-200";
      case "reviewing":
        return "bg-yellow-50 border-yellow-200";
      case "closed":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "open":
        return "default";
      case "reviewing":
        return "secondary";
      case "closed":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Card className={`border-l-4 ${getStatusColor(lockInfo.status)}`}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {getStatusIcon(lockInfo.status)}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{getStatusLabel(lockInfo.status)}</p>
                <Badge variant={getStatusBadgeVariant(lockInfo.status)}>
                  {lockInfo.period.month}/{lockInfo.period.year}
                </Badge>
              </div>

              {lockInfo.status === "closed" && (
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  {lockInfo.closedAt && (
                    <p>
                      Fechado em: <span className="font-mono">{formatDate(lockInfo.closedAt)}</span>
                    </p>
                  )}
                  {lockInfo.closedBy && (
                    <p>
                      Por: <span className="font-mono">{lockInfo.closedBy.slice(0, 8)}...</span>
                    </p>
                  )}
                  <p className="text-red-600 font-medium mt-2">
                    ⚠️ Edições, criações e exclusões estão bloqueadas neste período.
                  </p>
                </div>
              )}

              {lockInfo.status === "open" && (
                <p className="text-xs text-green-600 mt-1">
                  ✓ Você pode criar, editar e excluir registros normalmente.
                </p>
              )}

              {lockInfo.status === "reviewing" && (
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ Período em revisão. Edições podem ser limitadas.
                </p>
              )}

              {lockInfo.reopenedAt && (
                <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-gray-500">
                  <p>
                    Reaberto em: <span className="font-mono">{formatDate(lockInfo.reopenedAt)}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {lockInfo.status === "closed" && canReopen && (
            <button
              onClick={onReopenClick}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors whitespace-nowrap"
            >
              Reabrir Período
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
