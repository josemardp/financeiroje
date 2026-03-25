/**
 * FinanceAI — Audit Trail Component
 * 
 * Exibe a trilha de auditoria para:
 * - Eventos de fechamento
 * - Eventos de reabertura
 * - Alterações críticas de transações
 */

import { formatDate, formatTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Unlock, Edit2, Plus, Trash2 } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  context?: string;
  created_at: string;
  user_id: string;
}

interface AuditTrailProps {
  entries: AuditEntry[];
  isLoading?: boolean;
}

export function AuditTrail({ entries, isLoading }: AuditTrailProps) {
  const getActionIcon = (action: string) => {
    switch (action) {
      case "CLOSE_PERIOD":
        return <Lock className="w-4 h-4 text-red-500" />;
      case "REOPEN_PERIOD":
        return <Unlock className="w-4 h-4 text-green-500" />;
      case "INSERT":
        return <Plus className="w-4 h-4 text-blue-500" />;
      case "UPDATE":
        return <Edit2 className="w-4 h-4 text-yellow-500" />;
      case "DELETE":
        return <Trash2 className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case "CLOSE_PERIOD":
        return "Período Fechado";
      case "REOPEN_PERIOD":
        return "Período Reaberto";
      case "INSERT":
        return "Criado";
      case "UPDATE":
        return "Editado";
      case "DELETE":
        return "Excluído";
      default:
        return action;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "CLOSE_PERIOD":
        return "destructive";
      case "REOPEN_PERIOD":
        return "default";
      case "INSERT":
        return "secondary";
      case "UPDATE":
        return "secondary";
      case "DELETE":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trilha de Auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Carregando...</p>
        </CardContent>
      </Card>
    );
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Trilha de Auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Nenhum evento de auditoria registrado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Trilha de Auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start gap-3 pb-3 border-b border-gray-200 last:border-0"
            >
              <div className="mt-1">{getActionIcon(entry.action)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={getActionBadgeVariant(entry.action)}>
                    {getActionLabel(entry.action)}
                  </Badge>
                  <span className="text-xs text-gray-600">{entry.table_name}</span>
                </div>
                {entry.context && (
                  <p className="text-xs text-gray-700 mt-1 font-medium">{entry.context}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{formatDate(entry.created_at)}</span>
                  <span>•</span>
                  <span>{formatTime(entry.created_at)}</span>
                  <span>•</span>
                  <span className="font-mono">{entry.user_id.slice(0, 8)}...</span>
                </div>

                {/* Mostrar mudanças para UPDATE */}
                {entry.action === "UPDATE" && entry.old_data && entry.new_data && (
                  <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-200">
                    <p className="font-mono text-gray-600">
                      Mudanças: {JSON.stringify(entry.new_data).slice(0, 100)}...
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
