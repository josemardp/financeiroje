/**
 * FinanceAI — Hook para Operações de Fechamento
 * 
 * Gerencia:
 * - Fechamento de períodos
 * - Reabertura com auditoria
 * - Verificação de status de período
 * - Trilha de auditoria
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PeriodLockInfo } from "@/services/financeEngine/closingEngine";

export interface ClosingOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

export function useClosingOperations() {
  const queryClient = useQueryClient();

  // Query: Status do período
  const usePeriodStatus = (month: number, year: number) => {
    return useQuery({
      queryKey: ["period-status", month, year],
      queryFn: async (): Promise<PeriodLockInfo | null> => {
        try {
          const { data, error } = await supabase
            .from("monthly_closings")
            .select("status, fechado_em, fechado_por, reaberto_em, reaberto_por")
            .eq("mes", month)
            .eq("ano", year)
            .maybeSingle();

          if (error) throw error;

          if (!data) {
            return {
              period: { month, year },
              status: "open",
              isLocked: false,
            };
          }

          return {
            period: { month, year },
            status: data.status,
            isLocked: data.status === "closed",
            closedAt: data.fechado_em,
            closedBy: data.fechado_por,
            reopenedAt: data.reaberto_em,
            reopenedBy: data.reaberto_por,
          };
        } catch (err) {
          console.error("Erro ao obter status do período:", err);
          return null;
        }
      },
      enabled: month > 0 && year > 0,
    });
  };

  // Mutation: Fechar período
  const useClosePeriod = () => {
    return useMutation({
      mutationFn: async (payload: {
        month: number;
        year: number;
        snapshot?: Record<string, any>;
      }): Promise<ClosingOperationResult> => {
        try {
          const { data: existing } = await supabase
            .from("monthly_closings")
            .select("id")
            .eq("mes", payload.month)
            .eq("ano", payload.year)
            .maybeSingle();

          const closingPayload = {
            mes: payload.month,
            ano: payload.year,
            status: "closed" as const,
            fechado_em: new Date().toISOString(),
            fechado_por: (await supabase.auth.getUser()).data.user?.id,
            pendencias: payload.snapshot || {},
          };

          if (existing) {
            const { error } = await supabase
              .from("monthly_closings")
              .update(closingPayload)
              .eq("id", existing.id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("monthly_closings")
              .insert(closingPayload);
            if (error) throw error;
          }

          return {
            success: true,
            message: `Período ${payload.month}/${payload.year} fechado com sucesso`,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err.message,
          };
        }
      },
      onSuccess: (result, variables) => {
        if (result.success) {
          queryClient.invalidateQueries({
            queryKey: ["period-status", variables.month, variables.year],
          });
          queryClient.invalidateQueries({ queryKey: ["monthly-closing"] });
        }
      },
    });
  };

  // Mutation: Reabrir período
  const useReopenPeriod = () => {
    return useMutation({
      mutationFn: async (payload: {
        month: number;
        year: number;
        reason?: string;
      }): Promise<ClosingOperationResult> => {
        try {
          const { data: existing } = await supabase
            .from("monthly_closings")
            .select("id")
            .eq("mes", payload.month)
            .eq("ano", payload.year)
            .maybeSingle();

          if (!existing) {
            return {
              success: false,
              error: "Período não encontrado",
            };
          }

          const userId = (await supabase.auth.getUser()).data.user?.id;

          const { error } = await supabase
            .from("monthly_closings")
            .update({
              status: "open",
              fechado_em: null,
              fechado_por: null,
              reaberto_em: new Date().toISOString(),
              reaberto_por: userId,
              reabertura_motivo: payload.reason,
            })
            .eq("id", existing.id);

          if (error) throw error;

          return {
            success: true,
            message: `Período ${payload.month}/${payload.year} reaberto com sucesso`,
          };
        } catch (err: any) {
          return {
            success: false,
            error: err.message,
          };
        }
      },
      onSuccess: (result, variables) => {
        if (result.success) {
          queryClient.invalidateQueries({
            queryKey: ["period-status", variables.month, variables.year],
          });
          queryClient.invalidateQueries({ queryKey: ["monthly-closing"] });
        }
      },
    });
  };

  // Query: Trilha de auditoria
  const useAuditTrail = (month: number, year: number) => {
    return useQuery({
      queryKey: ["audit-trail", month, year],
      queryFn: async () => {
        try {
          const { data, error } = await supabase
            .from("audit_logs")
            .select("*")
            .in("context", [
              "Fechamento Mensal Realizado",
              "Reabertura de Período Auditada",
            ])
            .order("created_at", { ascending: false })
            .limit(50);

          if (error) throw error;

          return data || [];
        } catch (err) {
          console.error("Erro ao obter trilha de auditoria:", err);
          return [];
        }
      },
      enabled: month > 0 && year > 0,
    });
  };

  return {
    usePeriodStatus,
    useClosePeriod,
    useReopenPeriod,
    useAuditTrail,
  };
}
