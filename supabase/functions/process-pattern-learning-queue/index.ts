import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Claim atômico do lote (50 itens)
    const { data: batch, error: claimError } = await supabase.rpc(
      "claim_pattern_learning_batch",
      { p_batch_size: 50 },
    );

    if (claimError) {
      console.error("Erro ao fazer claim do lote:", claimError.message);
      throw claimError;
    }

    if (!batch || batch.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processando lote de ${batch.length} registros...`);

    // 2. Agrupar por user_id para otimizar chamadas
    const byUser = batch.reduce((acc: any, item: any) => {
      acc[item.user_id] = acc[item.user_id] || [];
      acc[item.user_id].push(item);
      return acc;
    }, {});

    const results = [];
    for (const [userId, items] of Object.entries(byUser)) {
      const typedItems = items as any[];
      
      // 3. Chamada em batch para learn-patterns
      try {
        const res = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/learn-patterns`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "from_corrections_batch",
              user_id: userId,
              corrections: typedItems.map((i) => ({
                transaction_id: i.transaction_id,
                new_category_id: i.new_category_id,
              })),
            }),
          },
        );

        if (res.ok) {
          // Sucesso: marcar como processado
          const ids = typedItems.map((i) => i.id);
          const { error: updateError } = await supabase
            .from("pattern_learning_queue")
            .update({ processed_at: new Date().toISOString() })
            .in("id", ids);

          if (updateError) {
            console.error(`Erro ao marcar como processado para user ${userId}:`, updateError.message);
          }
          
          results.push({ userId, status: "success", count: ids.length });
        } else {
          // Falha na função learn-patterns
          const errorText = await res.text();
          console.error(`Erro na learn-patterns para user ${userId}:`, errorText);
          
          const ids = typedItems.map((i) => i.id);
          await supabase.rpc("increment_queue_attempts", {
            p_ids: ids,
            p_error_msg: errorText.slice(0, 500),
          });
          
          results.push({ userId, status: "error", error: errorText });
        }
      } catch (err) {
        // Exceção de rede ou outra falha
        console.error(`Exceção ao processar user ${userId}:`, err);
        const ids = typedItems.map((i) => i.id);
        await supabase.rpc("increment_queue_attempts", {
          p_ids: ids,
          p_error_msg: err instanceof Error ? err.message : "Erro desconhecido",
        });
        results.push({ userId, status: "exception", error: String(err) });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Erro fatal na process-pattern-learning-queue:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
