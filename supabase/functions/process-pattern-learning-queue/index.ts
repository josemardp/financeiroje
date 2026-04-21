import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Iniciando processamento da fila pattern_learning_queue...");

  try {
    // 1. Claim do lote via RPC
    const { data: batch, error: claimError } = await supabase.rpc(
      "claim_pattern_learning_batch",
      { p_batch_size: 50 }
    );

    if (claimError) {
      console.error("Erro crítico na RPC claim_pattern_learning_batch:", claimError.message);
      return new Response(JSON.stringify({ error: claimError.message }), { status: 500 });
    }

    if (!batch || batch.length === 0) {
      console.log("Nenhum item pendente na fila.");
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
    }

    console.log(`Lote recebido: ${batch.length} registros para processar.`);

    // 2. Agrupar por usuário
    const byUser = batch.reduce((acc: any, item: any) => {
      acc[item.user_id] = acc[item.user_id] || [];
      acc[item.user_id].push(item);
      return acc;
    }, {});

    const summary = [];

    for (const [userId, items] of Object.entries(byUser)) {
      const typedItems = items as any[];
      const ids = typedItems.map(i => i.id);
      
      console.log(`Processando usuário ${userId} (${typedItems.length} itens)...`);

      try {
        // 3. Chamada para a inteligência de padrões
        const learnUrl = `${supabaseUrl}/functions/v1/learn-patterns`;
        console.log(`Chamando fetch: ${learnUrl} (Batch Mode)`);

        const res = await fetch(learnUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: "from_corrections_batch",
            user_id: userId,
            corrections: typedItems.map(i => ({
              transaction_id: i.transaction_id,
              new_category_id: i.new_category_id
            }))
          }),
        });

        if (res.ok) {
          const result = await res.json();
          console.log(`Sucesso para usuário ${userId}: ${result.patterns_written} padrões escritos.`);
          
          const { error: updErr } = await supabase
            .from("pattern_learning_queue")
            .update({ processed_at: new Date().toISOString() })
            .in("id", ids);

          if (updErr) console.error(`Erro ao atualizar processed_at:`, updErr.message);
          summary.push({ userId, status: "success", count: ids.length });
        } else {
          const errorBody = await res.text();
          console.warn(`Função learn-patterns retornou erro ${res.status} para user ${userId}:`, errorBody);
          
          await supabase.rpc("increment_queue_attempts", {
            p_ids: ids,
            p_error_msg: `HTTP ${res.status}: ${errorBody.slice(0, 400)}`
          });
          summary.push({ userId, status: "error", code: res.status });
        }
      } catch (userErr) {
        // Captura falhas de rede ou timeout específicos deste usuário
        console.error(`Exceção no processamento do usuário ${userId}:`, userErr);
        
        await supabase.rpc("increment_queue_attempts", {
          p_ids: ids,
          p_error_msg: `Exception: ${userErr instanceof Error ? userErr.message : String(userErr)}`
        });
        summary.push({ userId, status: "exception" });
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });

  } catch (fatalErr) {
    console.error("Erro fatal na orquestração da fila:", fatalErr);
    return new Response(JSON.stringify({ error: fatalErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
