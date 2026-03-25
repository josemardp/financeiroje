import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * FinanceAI — Edge Function para Operações de Fechamento
 * 
 * Endpoints:
 * 1. POST /closing-operations?action=close — Fechar período
 * 2. POST /closing-operations?action=reopen — Reabrir período
 * 3. GET /closing-operations?action=status&month=X&year=Y — Status do período
 * 4. GET /closing-operations?action=audit-trail&month=X&year=Y — Trilha de auditoria
 */

interface ClosingRequest {
  month: number;
  year: number;
  snapshot?: Record<string, any>;
  reason?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function closePeriod(req: ClosingRequest, supabase: any, userId: string) {
  const { month, year, snapshot } = req;

  try {
    // Verificar se já existe registro
    const { data: existing } = await supabase
      .from("monthly_closings")
      .select("id")
      .eq("user_id", userId)
      .eq("mes", month)
      .eq("ano", year)
      .maybeSingle();

    const payload = {
      user_id: userId,
      mes: month,
      ano: year,
      status: "closed",
      fechado_em: new Date().toISOString(),
      fechado_por: userId,
      pendencias: snapshot || {},
    };

    if (existing) {
      const { error } = await supabase
        .from("monthly_closings")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("monthly_closings")
        .insert(payload);
      if (error) throw error;
    }

    // Registrar evento de auditoria
    await supabase
      .from("audit_logs")
      .insert({
        user_id: userId,
        action: "CLOSE_PERIOD",
        table_name: "monthly_closings",
        new_data: payload,
        context: "Fechamento Mensal Realizado",
      });

    return {
      success: true,
      message: `Período ${month}/${year} fechado com sucesso`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function reopenPeriod(req: ClosingRequest, supabase: any, userId: string) {
  const { month, year, reason } = req;

  try {
    const { data: existing } = await supabase
      .from("monthly_closings")
      .select("id, status")
      .eq("user_id", userId)
      .eq("mes", month)
      .eq("ano", year)
      .maybeSingle();

    if (!existing) {
      return {
        success: false,
        error: "Período não encontrado",
      };
    }

    const updatePayload = {
      status: "open",
      fechado_em: null,
      fechado_por: null,
      reaberto_em: new Date().toISOString(),
      reaberto_por: userId,
      reabertura_motivo: reason || null,
    };

    const { error } = await supabase
      .from("monthly_closings")
      .update(updatePayload)
      .eq("id", existing.id);

    if (error) throw error;

    // Registrar evento de auditoria
    await supabase
      .from("audit_logs")
      .insert({
        user_id: userId,
        action: "REOPEN_PERIOD",
        table_name: "monthly_closings",
        new_data: updatePayload,
        context: "Reabertura de Período Auditada",
      });

    return {
      success: true,
      message: `Período ${month}/${year} reaberto com sucesso`,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function getPeriodStatus(month: number, year: number, supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from("monthly_closings")
      .select("status, fechado_em, fechado_por, reaberto_em, reaberto_por")
      .eq("user_id", userId)
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
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}

async function getAuditTrail(month: number, year: number, supabase: any, userId: string) {
  try {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("user_id", userId)
      .in("context", ["Fechamento Mensal Realizado", "Reabertura de Período Auditada"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return {
      entries: data || [],
      count: (data || []).length,
    };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "POST") {
      const body: ClosingRequest = await req.json();

      if (action === "close") {
        const result = await closePeriod(body, supabase, user.id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (action === "reopen") {
        const result = await reopenPeriod(body, supabase, user.id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (req.method === "GET") {
      const month = parseInt(url.searchParams.get("month") || "0");
      const year = parseInt(url.searchParams.get("year") || "0");

      if (action === "status") {
        const result = await getPeriodStatus(month, year, supabase, user.id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else if (action === "audit-trail") {
        const result = await getAuditTrail(month, year, supabase, user.id);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: corsHeaders }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
