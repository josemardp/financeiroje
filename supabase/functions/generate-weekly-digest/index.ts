import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Helper: Date Calculation ---
function getPreviousWeekRange() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Para pegar a segunda-feira da semana passada:
  // Se hoje é Terça (2), diffToLastMonday = (2-1) + 7 = 8 dias atrás.
  const diffToLastMonday = (day === 0 ? 6 : day - 1) + 7;
  
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diffToLastMonday);
  monday.setUTCHours(0, 0, 0, 0);
  
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);
  
  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
    week_start_date: monday.toISOString().split("T")[0],
    week_end_date: sunday.toISOString().split("T")[0],
  };
}

// --- Handler ---
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const IS_PRODUCTION = !SUPABASE_URL.includes("localhost") && !SUPABASE_URL.includes("127.0.0.1");
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  if (!OPENROUTER_API_KEY) {
    throw new Error("Chave OPENROUTER_API_KEY não configurada nas variáveis de ambiente.");
  }
  
  const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { start, end, week_start_date, week_end_date } = getPreviousWeekRange();

  console.log(`[WeeklyDigest] Period: ${week_start_date} to ${week_end_date}`);
  console.log(`[WeeklyDigest] Mode: ${IS_PRODUCTION ? "PRODUCTION" : "DRY-RUN"}`);

  try {
    // 1. Find active users (>= 3 engagement events last week)
    const { data: activeUsersData, error: userError } = await supabase
      .from("user_engagement_events")
      .select("user_id")
      .gte("created_at", start)
      .lte("created_at", end);

    if (userError) throw userError;

    const userEventCounts = (activeUsersData || []).reduce((acc: Record<string, number>, curr) => {
      acc[curr.user_id] = (acc[curr.user_id] || 0) + 1;
      return acc;
    }, {});

    const targetUserIds = Object.keys(userEventCounts).filter(id => userEventCounts[id] >= 3);
    console.log(`[WeeklyDigest] Found ${targetUserIds.length} active users.`);

    const results = [];

    for (const userId of targetUserIds) {
      console.log(`[WeeklyDigest] Processing user ${userId}...`);

      // 2. Gather Context
      const [tags, patterns, achievements, goals] = await Promise.all([
        supabase.from("behavioral_tags").select("tag_key, intensity, confidence").eq("user_id", userId).gt("intensity", 0.6).gte("detected_at", start),
        supabase.from("user_patterns").select("pattern_key, pattern_type, confidence").eq("user_id", userId).gte("updated_at", start),
        supabase.from("user_achievements").select("achievement_id, achievements_catalog(title)").eq("user_id", userId).gte("unlocked_at", start),
        supabase.from("goals").select("nome, valor_alvo, valor_atual, status").eq("user_id", userId).eq("ativo", true),
      ]);

      const context = {
        tags: tags.data || [],
        patterns: patterns.data || [],
        achievements: achievements.data || [],
        goals: goals.data || [],
      };

      // 3. Generate Content via LLM
      const systemPrompt = `Você é o assistente inteligente do FinanceiroJe. Sua tarefa é gerar um "Digest Semanal" resumindo a atividade do usuário.
      O tom deve ser direto, reflexivo e encorajador, sem ser invasivo ou imperativo.
      
      IMPORTANTE: Retorne APENAS um JSON no seguinte formato:
      {
        "observations": [{ "icon": "emoji", "title": "título curto", "text": "descrição" }],
        "recommendations": [{ "icon": "emoji", "title": "título curto", "text": "descrição" }],
        "celebrations": [{ "icon": "emoji", "title": "título curto", "text": "descrição" }]
      }
      
      - observations: baseie em behavioral_tags e patterns (ex: "Notei mais gastos em delivery").
      - recommendations: baseie em padrões ou metas (ex: "Considere reduzir gastos em X para atingir a meta Y").
      - celebrations: baseie em achievements e progresso de metas (ex: "Você atingiu 50% da meta Reserva!").
      
      Regras:
      - Use no máximo 3 itens por categoria.
      - Se não houver dados suficientes para uma categoria, retorne o array vazio.
      - Se TODOS os arrays forem vazios, o sistema não exibirá nada.
      - Zero alucinação: use apenas o contexto fornecido.`;

      const userPrompt = `Contexto da semana (${week_start_date} a ${week_end_date}):
      - Tags Comportamentais: ${JSON.stringify(context.tags)}
      - Padrões Detectados: ${JSON.stringify(context.patterns)}
      - Conquistas: ${JSON.stringify(context.achievements)}
      - Metas Ativas: ${JSON.stringify(context.goals)}`;

      const llmRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" }
        }),
      });

      if (!llmRes.ok) {
        console.error(`[WeeklyDigest] LLM error for user ${userId}: ${await llmRes.text()}`);
        continue;
      }

      const llmJson = await llmRes.json();
      const contentStr = llmJson.choices[0].message.content;
      let content;
      try {
        content = JSON.parse(contentStr);
        // Validação rigorosa da estrutura esperada
        if (
          !Array.isArray(content.observations) || 
          !Array.isArray(content.recommendations) || 
          !Array.isArray(content.celebrations)
        ) {
          throw new Error("Estrutura JSON inválida: campos obrigatórios devem ser arrays.");
        }
      } catch (e) {
        console.error(`[WeeklyDigest] Validação de conteúdo falhou para usuário ${userId}:`, e instanceof Error ? e.message : String(e));
        continue;
      }

      // 4. Validate and Persist
      const isEmpty = (content.observations?.length || 0) === 0 && 
                      (content.recommendations?.length || 0) === 0 && 
                      (content.celebrations?.length || 0) === 0;

      if (isEmpty) {
        console.log(`[WeeklyDigest] Skipping user ${userId} - no significant content.`);
        continue;
      }

      if (IS_PRODUCTION) {
        const { error: insertError } = await supabase
          .from("weekly_digests")
          .upsert({
            user_id: userId,
            week_start: week_start_date,
            week_end: week_end_date,
            content,
            scope: "private"
          }, { onConflict: "user_id, scope, week_start" });

        if (insertError) console.error(`[WeeklyDigest] DB error for user ${userId}:`, insertError.message);
        else results.push({ userId, status: "persisted" });
      } else {
        console.log(`[WeeklyDigest][DRY-RUN] Content for ${userId}:`, JSON.stringify(content, null, 2));
        results.push({ userId, status: "dry_run" });
      }
    }

    return new Response(JSON.stringify({ ok: true, period: { start: week_start_date, end: week_end_date }, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[WeeklyDigest] Fatal error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
