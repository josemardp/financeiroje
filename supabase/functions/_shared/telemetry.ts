import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/**
 * ⚠️ ESTES TIPOS ESTÃO ALINHADOS 1:1 COM OS CHECKS DO BANCO (Migration T1.1)
 */
export type HealthComponentType =
  | "cron"
  | "edge_function"
  | "db_index"
  | "embedding"
  | "external_api";

export type HealthStatus = "success" | "warning" | "error";

export interface RecordHealthInput {
  component_type: HealthComponentType;
  component_name: string;
  status: HealthStatus;
  duration_ms?: number | null;
  tokens_used?: number | null;
  metadata?: Record<string, unknown> | null;
  message?: string | null;
}

/**
 * Registro explícito de telemetria
 * - Nunca quebra fluxo principal
 * - Fail-safe total
 * - Truncamento automático de mensagens (max 1000 chars)
 */
export async function recordHealth(
  serviceClient: SupabaseClient,
  input: RecordHealthInput,
): Promise<void> {
  try {
    const { error } = await serviceClient
      .from("system_health_logs")
      .insert({
        component_type: input.component_type,
        component_name: input.component_name,
        status: input.status,
        duration_ms: input.duration_ms ?? null,
        tokens_used: input.tokens_used ?? null,
        metadata: input.metadata ?? {},
        message: input.message ? input.message.substring(0, 1000) : null,
      });

    if (error) {
      console.warn("[telemetry] insert error:", error.message);
    }
  } catch (err) {
    console.warn("[telemetry] unexpected failure:", err);
  }
}

export interface WithTelemetryParams<T> {
  serviceClient: SupabaseClient;
  component_type: HealthComponentType;
  component_name: string;
  metadata?: Record<string, unknown>;
  getTokensUsed?: (result: T) => number | null | undefined;
  fn: () => Promise<T>;
}

/**
 * Wrapper padrão para Edge Functions e crons
 */
export async function withTelemetry<T>(
  params: WithTelemetryParams<T>,
): Promise<T> {
  const start = Date.now();

  try {
    const result = await params.fn();
    const duration = Date.now() - start;

    await recordHealth(params.serviceClient, {
      component_type: params.component_type,
      component_name: params.component_name,
      status: "success",
      duration_ms: duration,
      tokens_used: params.getTokensUsed?.(result) ?? null,
      metadata: params.metadata ?? {},
    });

    return result;
  } catch (err) {
    const duration = Date.now() - start;

    await recordHealth(params.serviceClient, {
      component_type: params.component_type,
      component_name: params.component_name,
      status: "error",
      duration_ms: duration,
      tokens_used: null,
      metadata: params.metadata ?? {},
      message: (err instanceof Error ? err.message : String(err)).substring(0, 1000),
    });

    throw err;
  }
}
