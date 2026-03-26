/**
 * FinanceAI — Backend Service para Fechamento Mensal
 * 
 * Responsabilidades:
 * 1. Comunicar com Supabase para persistir fechamentos
 * 2. Registrar eventos de auditoria
 * 3. Validar permissões do usuário
 * 4. Retornar status de período com informações de bloqueio
 * 5. Executar reabertura com rastreabilidade
 */

import { supabase } from "@/integrations/supabase/client";
import type { PeriodLockInfo, ClosingSnapshot, ClosingAuditEvent } from "@/services/financeEngine/closingEngine";

// ─── Persistência de Fechamento ─────────────────────────────

export interface ClosingPayload {
  user_id: string;
  mes: number;
  ano: number;
  status: "open" | "reviewing" | "closed";
  total_receitas: number;
  total_despesas: number;
  saldo: number;
  fechado_em?: string;
  fechado_por?: string;
  pendencias?: Record<string, any>;
  resumo?: string;
}

/**
 * Persiste o fechamento de um período via Edge Function.
 */
export async function persistClosing(
  payload: ClosingPayload,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("closing-operations", {
      method: "POST",
      body: { 
        action: "close",
        month: payload.mes, 
        year: payload.ano, 
        snapshot: payload.pendencias 
      },
    });

    if (error) throw error;
    return { success: data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Obtém status de fechamento de um período via Edge Function.
 */
export async function getPeriodClosingStatus(
  userId: string,
  month: number,
  year: number,
): Promise<PeriodLockInfo | null> {
  try {
    const { data, error } = await supabase.functions.invoke("closing-operations", {
      method: "POST",
      body: { action: "status", month, year },
    });

    if (error) throw error;
    return data;
  } catch (err: any) {
    console.error("Erro ao obter status de fechamento via Edge Function:", err);
    // Fallback para consulta direta se a function falhar (para leitura apenas)
    const { data } = await supabase
      .from("monthly_closings")
      .select("status, fechado_em, fechado_por, reaberto_em, reaberto_por")
      .eq("user_id", userId)
      .eq("mes", month)
      .eq("ano", year)
      .maybeSingle();
    
    if (!data) return { period: { month, year }, status: "open", isLocked: false };
    return {
      period: { month, year },
      status: data.status,
      isLocked: data.status === "closed",
      closedAt: data.fechado_em,
      closedBy: data.fechado_por,
      reopenedAt: data.reaberto_em,
      reopenedBy: data.reaberto_por,
    };
  }
}

/**
 * Reabre um período fechado via Edge Function.
 */
export async function reopenPeriod(
  userId: string,
  month: number,
  year: number,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("closing-operations", {
      method: "POST",
      body: { 
        action: "reopen",
        month, 
        year, 
        reason 
      },
    });

    if (error) throw error;
    return { success: data.success, error: data.error };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Consulta de Auditoria ──────────────────────────────────

export interface AuditLogEntry {
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

/**
 * Obtém trilha de auditoria para um período.
 */
export async function getClosingAuditTrail(
  userId: string,
  month: number,
  year: number,
): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", userId)
      .in("context", ["Fechamento Mensal Realizado", "Reabertura de Período Auditada"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // Filtrar por período (aproximado, pois o período não é armazenado diretamente)
    // Em produção, seria melhor armazenar mes/ano em audit_logs
    return (data || []) as AuditLogEntry[];
  } catch (err: any) {
    console.error("Erro ao obter trilha de auditoria:", err);
    return [];
  }
}

/**
 * Obtém eventos de auditoria para transações de um período.
 */
export async function getTransactionAuditTrail(
  userId: string,
  month: number,
  year: number,
): Promise<AuditLogEntry[]> {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("table_name", "transactions")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    // Filtrar por período (verificando new_data.data ou old_data.data)
    return (data || []).filter((entry: any) => {
      const dataStr = entry.new_data?.data || entry.old_data?.data;
      if (!dataStr) return false;

      const date = new Date(dataStr);
      return date.getMonth() + 1 === month && date.getFullYear() === year;
    }) as AuditLogEntry[];
  } catch (err: any) {
    console.error("Erro ao obter trilha de transações:", err);
    return [];
  }
}

// ─── Verificação de Bloqueio no Backend ──────────────────────

/**
 * Verifica se uma operação em um período está bloqueada.
 * Consulta o status do período no banco.
 */
export async function checkOperationBlocked(
  userId: string,
  month: number,
  year: number,
  operationType: "insert" | "update" | "delete",
): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const status = await getPeriodClosingStatus(userId, month, year);

    if (!status || status.status !== "closed") {
      return { blocked: false };
    }

    return {
      blocked: true,
      reason: `Período ${month}/${year} está fechado. ${operationType === "insert" ? "Não é possível criar" : operationType === "update" ? "Não é possível editar" : "Não é possível excluir"} registros neste período.`,
    };
  } catch (err: any) {
    console.error("Erro ao verificar bloqueio:", err);
    return { blocked: false };
  }
}

// ─── Snapshot de Período ────────────────────────────────────

/**
 * Obtém snapshot completo de um período para auditoria.
 */
export async function getClosingSnapshot(
  userId: string,
  month: number,
  year: number,
): Promise<{ data?: Record<string, any>; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("monthly_closings")
      .select("*")
      .eq("user_id", userId)
      .eq("mes", month)
      .eq("ano", year)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { error: "Período não encontrado" };
    }

    return { data };
  } catch (err: any) {
    return { error: err.message };
  }
}
