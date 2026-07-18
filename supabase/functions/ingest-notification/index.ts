import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { checkRateLimit } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RATE_LIMIT = 60; // 60 requisições por minuto por usuário
const RATE_WINDOW_MS = 60_000;

function parseAmount(val: string): number | null {
  const clean = val.replace(/\s+/g, "").replace(/R\$/gi, "").replace(/\./g, "").replace(",", ".");
  const num = parseFloat(clean);
  return isNaN(num) || num <= 0 ? null : num;
}

interface ParsedResult {
  amount: number | null;
  merchant: string;
  type: "income" | "expense";
}

function parseNotificationLocally(packageName: string, title: string, text: string): ParsedResult | null {
  const fullText = `${title}: ${text}`.trim();

  // Nubank
  if (packageName === "com.nu.production") {
    // Ex: "Nubank: Compra de R$ 47,90 no Mercado Pago aprovada" ou "Você gastou R$ 15,00 no estabelecimento X"
    const m1 = fullText.match(/(?:compra de|gastou|compra aprovada de)\s*R\$\s*([\d.,]+)\s*(?:no|em|na|estabelecimento)\s*(.*?)\s*(?:aprovada|realizada|$)/i);
    if (m1) {
      return {
        amount: parseAmount(m1[1]),
        merchant: m1[2].replace(/aprovada|realizada/gi, "").trim(),
        type: "expense",
      };
    }
    // Ex: "Você recebeu um Pix de R$ 100,00 de João Silva"
    const m2 = fullText.match(/recebeu um Pix de R\$\s*([\d.,]+)\s*de\s*(.+)/i);
    if (m2) {
      return {
        amount: parseAmount(m2[1]),
        merchant: m2[2].trim(),
        type: "income",
      };
    }
  }

  // Itaú
  if (packageName === "com.itau") {
    // Ex: "Itaú: Compra aprovada no seu cartao - R$ 47,90 no estabelecimento Mercado X"
    const m1 = fullText.match(/compra aprovada.*?R\$\s*([\d.,]+)\s*(?:no estabelecimento|em|na)\s*(.+)/i);
    if (m1) {
      return {
        amount: parseAmount(m1[1]),
        merchant: m1[2].trim(),
        type: "expense",
      };
    }
  }

  // PicPay
  if (packageName === "com.picpay") {
    // Ex: "PicPay: Pagamento de R$ 30,00 para João aprovado"
    const m1 = fullText.match(/pagamento de R\$\s*([\d.,]+)\s*para\s*(.*?)\s*(?:aprovado|realizado|$)/i);
    if (m1) {
      return {
        amount: parseAmount(m1[1]),
        merchant: m1[2].trim(),
        type: "expense",
      };
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const token = authHeader.replace("Bearer ", "");

    // Criar cliente Supabase com a sessão do usuário
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limiting por usuário
    if (!await checkRateLimit(`ingest-notification:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições excedido. Aguarde." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Payload vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { packageName, title, text, hash, postTime } = body;
    if (!packageName || !text || !hash) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios ausentes" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Deduplicação: verificar se o hash já foi processado
    const { data: existingEvent, error: selectError } = await supabase
      .from("notification_capture_events")
      .select("id, transaction_id")
      .eq("notification_hash", hash)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    if (existingEvent) {
      return new Response(
        JSON.stringify({ message: "Notificação já processada anteriormente (duplicada).", id: existingEvent.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Tentar parser local
    let parsed = parseNotificationLocally(packageName, title || "", text);
    let usedAI = false;

    // 3. Fallback para IA se o parser local falhar
    if (!parsed || parsed.amount === null) {
      try {
        const interpretRes = await fetch(
          `${supabaseUrl}/functions/v1/smart-capture-interpret`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              text: `${title ? title + ": " : ""}${text}`,
              source_kind: "bank_notification",
            }),
          }
        );

        if (interpretRes.ok) {
          const aiData = await interpretRes.json();
          if (aiData?.metadata) {
            parsed = {
              amount: aiData.metadata.amount ?? null,
              merchant: aiData.metadata.merchantName ?? aiData.metadata.counterparty ?? "Notificação Bancária",
              type: aiData.metadata.transactionType === "income" ? "income" : "expense",
            };
            usedAI = true;
          }
        }
      } catch (aiErr) {
        console.error("Falha ao chamar fallback da IA:", aiErr);
      }
    }

    // Padrões se tudo falhar
    const finalAmount = parsed?.amount ?? null;
    const finalMerchant = parsed?.merchant ?? "Notificação Bancária";
    const finalType = parsed?.type ?? "expense";

    // 4. Criar transação sugerida (suggested)
    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    
    const { data: newTx, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        valor: finalAmount ?? 0,
        tipo: finalType,
        descricao: finalMerchant,
        data: todayStr,
        scope: "private",
        source_type: "notification",
        data_status: "suggested",
        confidence: usedAI ? "media" : "alta", // Alta se o regex bateu certinho, média se usou IA
        validation_notes: `Capturado via notificação do celular (${packageName})` + (finalAmount === null ? " - Valor ausente." : ""),
      })
      .select("id")
      .single();

    if (txError) {
      throw txError;
    }

    // 5. Salvar o evento de captura
    const { data: newEvent, error: eventError } = await supabase
      .from("notification_capture_events")
      .insert({
        user_id: user.id,
        source_app: packageName,
        notification_hash: hash,
        title: title || null,
        content: text,
        parsed_amount: finalAmount,
        parsed_merchant: finalMerchant,
        parsed_type: finalType,
        transaction_id: newTx.id,
      })
      .select("id")
      .single();

    if (eventError) {
      // Se falhar ao salvar o evento, tentamos remover a transação órfã para manter integridade
      await supabase.from("transactions").delete().eq("id", newTx.id);
      throw eventError;
    }

    return new Response(
      JSON.stringify({
        message: "Notificação ingesta com sucesso.",
        event_id: newEvent.id,
        transaction_id: newTx.id,
        parsed: {
          amount: finalAmount,
          merchant: finalMerchant,
          type: finalType,
          used_ai: usedAI,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ingest-notification error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
